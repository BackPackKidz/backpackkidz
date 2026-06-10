import { formatCurrency, getDonorDisplayName } from "./donation-utils.mjs";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const line = (label, value) => `${label}: ${value || "Not provided"}`;

const buildAddress = (donor) =>
  [donor.address, donor.city, donor.state, donor.zip].filter(Boolean).join(", ");

const honorSummary = (record) => {
  const honor = record.honor_message;

  if (!honor.in_honor_enabled) {
    return "None";
  }

  return `${honor.honor_type} ${honor.honoree_name}${
    honor.honor_message ? ` - ${honor.honor_message}` : ""
  }`;
};

export const donorConfirmationText = (record, paypalUrl) => {
  const donorName = getDonorDisplayName(record);

  return [
    `Dear ${donorName},`,
    "",
    "Thank you for choosing to support Backpack Kidz. We've received your donation information. If you completed your payment through PayPal, Backpack Kidz will use this information to properly track your gift and follow up with a thank-you.",
    "",
    line("Donation amount entered", formatCurrency(record.donation.amount)),
    line("Donor name/business", donorName),
    line("Honor message", honorSummary(record)),
    "",
    "This message is not a tax receipt or official payment confirmation. PayPal handles the payment, and Backpack Kidz will reconcile this pending record with PayPal activity.",
    "",
    `Continue to PayPal if needed: ${paypalUrl}`,
    "",
    "Questions? Contact Backpack Kidz at info@backpackkidz.com.",
  ].join("\n");
};

export const donorConfirmationHtml = (record, paypalUrl) => {
  const donorName = getDonorDisplayName(record);

  return `
    <p>Dear ${escapeHtml(donorName)},</p>
    <p>Thank you for choosing to support Backpack Kidz. We've received your donation information. If you completed your payment through PayPal, Backpack Kidz will use this information to properly track your gift and follow up with a thank-you.</p>
    <ul>
      <li><strong>Donation amount entered:</strong> ${escapeHtml(formatCurrency(record.donation.amount))}</li>
      <li><strong>Donor name/business:</strong> ${escapeHtml(donorName)}</li>
      <li><strong>Honor message:</strong> ${escapeHtml(honorSummary(record))}</li>
    </ul>
    <p>This message is not a tax receipt or official payment confirmation. PayPal handles the payment, and Backpack Kidz will reconcile this pending record with PayPal activity.</p>
    <p><a href="${escapeHtml(paypalUrl)}">Continue to PayPal</a></p>
    <p>Questions? Contact Backpack Kidz at <a href="mailto:info@backpackkidz.com">info@backpackkidz.com</a>.</p>
  `;
};

export const adminNotificationText = (record) => {
  const donor = record.donor;
  const tracking = record.thank_you_tracking;

  return [
    "A new Backpack Kidz donation record was created.",
    "",
    line("Donor", getDonorDisplayName(record)),
    line("Email", donor.email),
    line("Phone", donor.phone),
    line("Mailing address", buildAddress(donor)),
    line("Donation amount", formatCurrency(record.donation.amount)),
    line("Honor message", honorSummary(record)),
    line("Public recognition allowed", donor.public_recognition_allowed ? "Yes" : "No"),
    line("Thank-you card needed", tracking.thank_you_card_needed ? "Yes" : "No"),
    line("Thank-you gift needed", tracking.thank_you_gift_needed ? "Yes" : "No"),
    line("Payment status", record.donation.payment_status),
    line("Timestamp", record.created_at),
  ].join("\n");
};

export const adminNotificationHtml = (record) => {
  const donor = record.donor;
  const tracking = record.thank_you_tracking;

  return `
    <p>A new Backpack Kidz donation record was created.</p>
    <ul>
      <li><strong>Donor:</strong> ${escapeHtml(getDonorDisplayName(record))}</li>
      <li><strong>Email:</strong> ${escapeHtml(donor.email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(donor.phone || "Not provided")}</li>
      <li><strong>Mailing address:</strong> ${escapeHtml(buildAddress(donor) || "Not provided")}</li>
      <li><strong>Donation amount:</strong> ${escapeHtml(formatCurrency(record.donation.amount))}</li>
      <li><strong>Honor message:</strong> ${escapeHtml(honorSummary(record))}</li>
      <li><strong>Public recognition allowed:</strong> ${donor.public_recognition_allowed ? "Yes" : "No"}</li>
      <li><strong>Thank-you card needed:</strong> ${tracking.thank_you_card_needed ? "Yes" : "No"}</li>
      <li><strong>Thank-you gift needed:</strong> ${tracking.thank_you_gift_needed ? "Yes" : "No"}</li>
      <li><strong>Payment status:</strong> ${escapeHtml(record.donation.payment_status)}</li>
      <li><strong>Timestamp:</strong> ${escapeHtml(record.created_at)}</li>
    </ul>
  `;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.warn("Donation email skipped: RESEND_API_KEY and FROM_EMAIL are required.");
    return { sent: false, reason: "missing_email_config" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${responseText}`);
  }

  return { sent: true };
};
