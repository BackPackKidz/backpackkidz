import { getStore } from "@netlify/blobs";
import { createDonationRecord, donationHonorSummary } from "../donation-utils.mjs";
import { sendNotificationEmail } from "../email-utils.mjs";
import { appendPendingDonationRow } from "../google-sheets-utils.mjs";
import { buildPaypalDonationUrl } from "../paypal-utils.mjs";

/*
  Donation-intent endpoint ("create donation intent"):
  the donor form posts here BEFORE anyone is sent to PayPal.

  1. Validate and save the donation as a Pending record (Netlify Blobs).
  2. Mirror it as a Pending row in the Google Sheets bookkeeping document.
  3. Return a PayPal URL carrying the amount, the donation ID (`custom`),
     and our IPN notify_url; the front-end injects it into the
     "Continue to secure PayPal donation" button.

  The donation is only marked Completed later, by
  netlify/functions/paypal-ipn.js, after PayPal verifies the payment.
*/

const jsonResponse = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        error: "Request body must be valid JSON.",
        fields: [],
      },
      400
    );
  }

  const result = createDonationRecord(body);

  if (result.error) {
    return jsonResponse(
      {
        error: result.error,
        fields: result.fields,
      },
      400
    );
  }

  const { record } = result;
  const store = getStore("donations");

  try {
    await store.set(record.id, JSON.stringify(record));
  } catch (error) {
    console.error("Donation record save failed:", error);
    return jsonResponse({ error: "Failed to save donation." }, 500);
  }

  // Bookkeeping mirror — fail-soft: a Sheets outage or missing credentials
  // must never block the donor's path to PayPal.
  try {
    await appendPendingDonationRow(record, donationHonorSummary(record));
  } catch (error) {
    console.error("Google Sheets pending-donation row failed:", error);
  }

  // Fail-soft: the record is already saved; a failed email only logs.
  await sendNotificationEmail({
    recordType: "donation",
    subject: `New donation info: $${record.amount} from ${
      record.donorName || record.organizationName
    }`,
    record,
  });

  // The front-end (script.js) swaps this URL into the success panel's
  // PayPal button, so the payment carries the donation ID with it.
  return jsonResponse({
    success: true,
    paypal_url: buildPaypalDonationUrl(record),
  });
};

export const config = {
  path: "/api/donations",
};
