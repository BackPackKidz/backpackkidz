import { getStore } from "@netlify/blobs";
import {
  createDonationRecord,
  DEFAULT_PAYPAL_DONATION_URL,
  donationStorageKey,
} from "../donation-utils.mjs";
import {
  adminNotificationHtml,
  adminNotificationText,
  donorConfirmationHtml,
  donorConfirmationText,
  sendEmail,
} from "../donation-email.mjs";

const jsonResponse = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

const getPaypalUrl = () =>
  process.env.PAYPAL_DONATION_URL || DEFAULT_PAYPAL_DONATION_URL;

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const result = createDonationRecord(body);

  if (result.errors) {
    return jsonResponse({ errors: result.errors }, 400);
  }

  const { record } = result;
  const storageKey = donationStorageKey(record);
  const store = getStore({ name: "donation-records", consistency: "strong" });

  try {
    // This is a donation intent only. PayPal remains the payment source of truth.
    await store.setJSON(storageKey, record, {
      metadata: {
        created_at: record.created_at,
        payment_status: record.donation.payment_status,
      },
      onlyIfNew: true,
    });
  } catch (error) {
    console.error("Donation record save failed:", error);
    return jsonResponse({ error: "Donation information could not be saved." }, 500);
  }

  const paypalUrl = getPaypalUrl();
  let donorEmailSent = false;

  try {
    const donorEmail = await sendEmail({
      to: record.donor.email,
      subject: "Thank you for supporting Backpack Kidz",
      text: donorConfirmationText(record, paypalUrl),
      html: donorConfirmationHtml(record, paypalUrl),
    });

    donorEmailSent = donorEmail.sent;
  } catch (error) {
    console.warn("Donation donor confirmation email failed:", error);
  }

  if (donorEmailSent) {
    record.thank_you_tracking.thank_you_email_sent = true;

    try {
      await store.setJSON(storageKey, record, {
        metadata: {
          created_at: record.created_at,
          payment_status: record.donation.payment_status,
        },
      });
    } catch (error) {
      console.warn("Donation email tracking update failed:", error);
    }
  }

  if (process.env.DONATION_ADMIN_EMAIL) {
    try {
      await sendEmail({
        to: process.env.DONATION_ADMIN_EMAIL,
        subject: "New Backpack Kidz donation record",
        text: adminNotificationText(record),
        html: adminNotificationHtml(record),
      });
    } catch (error) {
      console.warn("Donation admin notification email failed:", error);
    }
  } else {
    console.warn("Donation admin email skipped: DONATION_ADMIN_EMAIL is not configured.");
  }

  return jsonResponse({
    donation_id: record.donation.id,
    payment_status: record.donation.payment_status,
    paypal_url: paypalUrl,
    message: "Donation information received.",
  });
};

export const config = {
  path: "/api/donations",
};
