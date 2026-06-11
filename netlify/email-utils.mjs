import nodemailer from "nodemailer";

/*
  Sends a notification email to the Back Pack Kidz team whenever a form is
  submitted. Sending is fail-soft: if SMTP is not configured or the send
  fails, the submission is still saved to Netlify Blobs and the visitor
  still sees a success message — the problem is only logged.

  Required environment variables (set in the Netlify dashboard):
    SMTP_USER  - the Google Workspace mailbox used to send, e.g.
                 contact@backpackkidz.com
    SMTP_PASS  - an App Password for that mailbox (Google Account ->
                 Security -> 2-Step Verification -> App passwords)

  Optional:
    SMTP_HOST / SMTP_PORT       - default smtp.gmail.com / 465
    NOTIFY_FROM                 - From address, defaults to SMTP_USER
    CONTACTS_NOTIFY_EMAIL       - default contact@backpackkidz.com
    DONATIONS_NOTIFY_EMAIL      - default donate@backpackkidz.com
    SPONSORSHIPS_NOTIFY_EMAIL   - default donate@backpackkidz.com
    VOLUNTEERS_NOTIFY_EMAIL     - default contact@backpackkidz.com
    PARTNERS_NOTIFY_EMAIL       - default partners@backpackkidz.com
*/

const DEFAULT_RECIPIENTS = {
  contact: "contact@backpackkidz.com",
  donation: "donate@backpackkidz.com",
  sponsorship: "donate@backpackkidz.com",
  volunteer: "contact@backpackkidz.com",
  partner: "partners@backpackkidz.com",
};

const RECIPIENT_ENV_VARS = {
  contact: "CONTACTS_NOTIFY_EMAIL",
  donation: "DONATIONS_NOTIFY_EMAIL",
  sponsorship: "SPONSORSHIPS_NOTIFY_EMAIL",
  volunteer: "VOLUNTEERS_NOTIFY_EMAIL",
  partner: "PARTNERS_NOTIFY_EMAIL",
};

export const notificationRecipient = (recordType) =>
  process.env[RECIPIENT_ENV_VARS[recordType]] ||
  DEFAULT_RECIPIENTS[recordType];

const labelize = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

export const formatRecordAsText = (record) =>
  Object.entries(record)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${labelize(key)}: ${value}`)
    .join("\n");

export const sendNotificationEmail = async ({ recordType, subject, record }) => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn(
      `Email notification skipped for ${recordType}: SMTP_USER/SMTP_PASS are not configured.`
    );
    return { sent: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: process.env.NOTIFY_FROM || user,
      to: notificationRecipient(recordType),
      // Reply goes straight to the visitor when they shared an email.
      replyTo: record.email || undefined,
      subject,
      text: `${formatRecordAsText(record)}\n\n—\nSent automatically by the backpackkidz.com website.`,
    });

    return { sent: true };
  } catch (error) {
    console.error(`Email notification failed for ${recordType}:`, error);
    return { sent: false };
  }
};
