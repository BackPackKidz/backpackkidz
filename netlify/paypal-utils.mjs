/*
  Builds the PayPal URL the donor is sent to after saving the optional
  donation form. Two modes:

  1. PAYPAL_BUSINESS set (preferred for bookkeeping): build a classic
     PayPal Donations URL (cmd=_donations). This flow officially supports
     passing the amount, a `custom` value (our donation ID, echoed back in
     the IPN message), and a per-transaction `notify_url` pointing at our
     IPN function — which is what lets the IPN handler match the payment
     back to the pending donation record.

  2. PAYPAL_BUSINESS not set: fall back to the existing hosted donate
     button link, appending amount/custom as a best effort. The hosted
     button flow does not guarantee passthrough of these parameters, so
     the owner should also enable IPN account-wide in PayPal
     (Account Settings -> Notifications -> Instant payment notifications)
     pointing at PAYPAL_NOTIFY_URL; unmatched confirmed payments are still
     booked as their own sheet rows.

  PAYPAL_ENV=sandbox switches to the PayPal sandbox host for testing.
*/

export const DEFAULT_HOSTED_DONATE_URL =
  "https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2";

export const DEFAULT_NOTIFY_URL =
  "https://www.backpackkidz.com/.netlify/functions/paypal-ipn";

export const buildPaypalDonationUrl = (record, env = process.env) => {
  const notifyUrl = env.PAYPAL_NOTIFY_URL || DEFAULT_NOTIFY_URL;

  // The form no longer collects an amount; when none is present the
  // amount parameter is omitted and the donor chooses it on PayPal's page.
  const numericAmount = Number(record.amount);
  const amount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? numericAmount.toFixed(2)
      : "";

  if (env.PAYPAL_BUSINESS) {
    const host =
      env.PAYPAL_ENV === "sandbox" ? "www.sandbox.paypal.com" : "www.paypal.com";
    const params = new URLSearchParams({
      cmd: "_donations",
      business: env.PAYPAL_BUSINESS,
      item_name: "Back Pack Kidz Donation",
      currency_code: env.PAYPAL_CURRENCY || "USD",
      custom: record.id,
      notify_url: notifyUrl,
    });

    if (amount) {
      params.set("amount", amount);
    }

    return `https://${host}/cgi-bin/webscr?${params.toString()}`;
  }

  const url = new URL(env.PAYPAL_DONATION_URL || DEFAULT_HOSTED_DONATE_URL);
  url.searchParams.set("custom", record.id);

  if (amount) {
    url.searchParams.set("amount", amount);
  }

  return url.toString();
};
