import { getStore } from "@netlify/blobs";
import { donationHonorSummary } from "../donation-utils.mjs";
import { sendEmail } from "../email-utils.mjs";
import {
  markDonationCompletedInSheet,
  appendUnmatchedCompletedRow,
} from "../google-sheets-utils.mjs";

/*
  PayPal IPN (Instant Payment Notification) listener.
  URL: https://www.backpackkidz.com/.netlify/functions/paypal-ipn

  This is the ONLY place a donation is marked Completed. The front-end and
  the donation-intent endpoint never do that — clicking the PayPal button
  proves nothing; only a VERIFIED IPN message with payment_status=Completed
  counts.

  Flow:
    1. PayPal POSTs the IPN message here after a payment event.
    2. We echo the EXACT raw body back to PayPal prefixed with
       cmd=_notify-validate (PayPal's required validation handshake) and
       proceed only if PayPal answers "VERIFIED".
    3. Skip anything that is not payment_status=Completed.
    4. Dedupe by transaction ID (a Blobs store of processed txn_ids), since
       PayPal may retry the same notification.
    5. Match the donation via the `custom` field (our donation ID), flip the
       Blobs record and the Google Sheets row from Pending to Completed, and
       store the paid amount / transaction ID / payer email / timestamp.
       Confirmed payments without a matching record (e.g. the direct PayPal
       button) are appended to the sheet as their own row.
    6. Email hello@backpackkidz.com that a donation was received.

  Responses: PayPal only cares about the HTTP status. We return 200 for
  anything we have fully handled (including messages we deliberately ignore)
  and 500 only for our own transient failures, so PayPal retries those.
*/

const VERIFY_URLS = {
  live: "https://ipnpb.paypal.com/cgi-bin/webscr",
  sandbox: "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr",
};

const ok = (message = "OK") => new Response(message, { status: 200 });

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await request.text();

  // --- Step 1: PayPal validation handshake -------------------------------
  let verdict = "";

  try {
    const verifyUrl =
      process.env.PAYPAL_ENV === "sandbox" ? VERIFY_URLS.sandbox : VERIFY_URLS.live;
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // The raw body must be echoed back unmodified for verification.
      body: `cmd=_notify-validate&${rawBody}`,
    });
    verdict = (await response.text()).trim();
  } catch (error) {
    console.error("PayPal IPN: verification request failed:", error);
    // 500 so PayPal retries — this was our failure, not a bad message.
    return new Response("Verification unavailable", { status: 500 });
  }

  if (verdict !== "VERIFIED") {
    // Spoofed or malformed message; retrying would not change the verdict.
    console.error(`PayPal IPN: rejected message (verification returned "${verdict}").`);
    return ok();
  }

  // --- Step 2: extract the fields we care about --------------------------
  const params = new URLSearchParams(rawBody);
  const paymentStatus = params.get("payment_status") || "";
  const txnId = params.get("txn_id") || "";
  const donationId = params.get("custom") || "";
  const paidAmount = params.get("mc_gross") || "";
  const payerEmail = params.get("payer_email") || "";
  const payerName = [params.get("first_name"), params.get("last_name")]
    .filter(Boolean)
    .join(" ");

  if (paymentStatus !== "Completed") {
    console.log(
      `PayPal IPN: ignoring payment_status="${paymentStatus}" (txn ${txnId || "unknown"}).`
    );
    return ok();
  }

  if (!txnId) {
    console.error("PayPal IPN: completed payment without a txn_id; ignoring.");
    return ok();
  }

  // Optional safety check that the money went to OUR PayPal account.
  const expectedReceiver = (process.env.PAYPAL_RECEIVER_EMAIL || "").toLowerCase();

  if (expectedReceiver) {
    const receiver = (
      params.get("receiver_email") ||
      params.get("business") ||
      ""
    ).toLowerCase();

    if (receiver !== expectedReceiver) {
      console.error(`PayPal IPN: receiver mismatch ("${receiver}"); ignoring.`);
      return ok();
    }
  }

  // --- Step 3: duplicate prevention by transaction ID --------------------
  const processedTxns = getStore("paypal-transactions");

  try {
    if (await processedTxns.get(txnId)) {
      console.log(`PayPal IPN: txn ${txnId} already processed; skipping.`);
      return ok();
    }
  } catch (error) {
    console.error("PayPal IPN: duplicate check failed:", error);
    return new Response("Storage unavailable", { status: 500 });
  }

  const completedAt = new Date().toISOString();

  // --- Step 4: mark the pending donation record Completed ----------------
  let record = null;

  if (donationId) {
    const donations = getStore("donations");

    try {
      record = await donations.get(donationId, { type: "json" });

      if (record) {
        record.status = "Completed";
        record.paypalTxnId = txnId;
        record.paidAmount = paidAmount;
        record.payerEmail = payerEmail;
        record.completedAt = completedAt;
        await donations.set(donationId, JSON.stringify(record));
      } else {
        console.error(`PayPal IPN: no donation record found for ID "${donationId}".`);
      }
    } catch (error) {
      console.error("PayPal IPN: donation record update failed:", error);
      return new Response("Storage unavailable", { status: 500 });
    }
  }

  try {
    await processedTxns.set(txnId, JSON.stringify({ donationId, completedAt }));
  } catch (error) {
    console.error("PayPal IPN: failed to record processed txn:", error);
    return new Response("Storage unavailable", { status: 500 });
  }

  // --- Step 5: Google Sheets bookkeeping (fail-soft from here on) --------
  try {
    const updated = record
      ? await markDonationCompletedInSheet({
          donationId,
          txnId,
          paidAmount,
          payerEmail,
          completedAt,
        })
      : false;

    if (!updated) {
      await appendUnmatchedCompletedRow({
        donationId,
        txnId,
        paidAmount,
        payerEmail,
        payerName: record?.donorName || record?.organizationName || payerName,
        completedAt,
      });
    }
  } catch (error) {
    console.error("PayPal IPN: Google Sheets update failed:", error);
  }

  // --- Step 6: notify the team --------------------------------------------
  const donorName =
    record?.donorName || record?.organizationName || payerName || "Anonymous donor";
  const donorEmail = record?.email || payerEmail;
  const honorSummary = record ? donationHonorSummary(record) : "";

  const bodyLines = [
    `Donor name: ${donorName}`,
    `Donation amount: $${paidAmount}`,
    donorEmail ? `Donor email: ${donorEmail}` : null,
    honorSummary ? `In honor of: ${honorSummary}` : null,
    `PayPal transaction ID: ${txnId}`,
    `Date/time: ${completedAt}`,
    "",
    "—",
    "Confirmed by PayPal IPN and recorded automatically by backpackkidz.com.",
  ].filter((line) => line !== null);

  await sendEmail({
    to: process.env.DONATION_RECEIVED_EMAIL || "hello@backpackkidz.com",
    subject: "New Backpack Kidz Donation Received",
    text: bodyLines.join("\n"),
  });

  return ok();
};
