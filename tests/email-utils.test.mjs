import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

import {
  formatRecordAsText,
  notificationRecipient,
  sendNotificationEmail,
} from "../netlify/email-utils.mjs";

test("formats record fields as readable lines and skips empty values", () => {
  const text = formatRecordAsText({
    name: "Pat Smith",
    email: "pat@example.com",
    phone: "",
    subject: undefined,
    preferredContact: null,
    donorName: "Helping Hands",
  });

  assert.equal(
    text,
    "Name: Pat Smith\nEmail: pat@example.com\nDonor Name: Helping Hands"
  );
});

test("uses the default recipient for each record type", () => {
  assert.equal(notificationRecipient("contact"), "contact@backpackkidz.com");
  assert.equal(notificationRecipient("donation"), "donate@backpackkidz.com");
  assert.equal(notificationRecipient("sponsorship"), "donate@backpackkidz.com");
  assert.equal(notificationRecipient("volunteer"), "contact@backpackkidz.com");
  assert.equal(notificationRecipient("partner"), "partners@backpackkidz.com");
});

test("environment variable overrides the default recipient", () => {
  process.env.CONTACTS_NOTIFY_EMAIL = "override@backpackkidz.com";

  try {
    assert.equal(notificationRecipient("contact"), "override@backpackkidz.com");
  } finally {
    delete process.env.CONTACTS_NOTIFY_EMAIL;
  }
});

test("skips sending without failing when SMTP is not configured", async () => {
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  const result = await sendNotificationEmail({
    recordType: "contact",
    subject: "Test",
    record: { email: "pat@example.com" },
  });

  assert.deepEqual(result, { sent: false });
});

test("builds the notification SMTP message without raw, file, or URL inputs", async () => {
  const originalCreateTransport = nodemailer.createTransport;
  const originalEnvironment = {
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    NOTIFY_FROM: process.env.NOTIFY_FROM,
    CONTACTS_NOTIFY_EMAIL: process.env.CONTACTS_NOTIFY_EMAIL,
  };
  let transportOptions;
  let message;

  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return {
      sendMail: async (mail) => {
        message = mail;
        return { accepted: [mail.to] };
      },
    };
  };

  Object.assign(process.env, {
    SMTP_USER: "smtp-user@example.com",
    SMTP_PASS: "test-only-password",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    NOTIFY_FROM: "website@example.com",
    CONTACTS_NOTIFY_EMAIL: "contact-team@example.com",
  });

  try {
    const result = await sendNotificationEmail({
      recordType: "contact",
      subject: "New contact form submission",
      record: {
        name: "Pat Smith",
        email: "pat@example.com",
        message: "Please call me.",
      },
    });

    assert.deepEqual(result, { sent: true });
    assert.deepEqual(transportOptions, {
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: {
        user: "smtp-user@example.com",
        pass: "test-only-password",
      },
    });
    assert.deepEqual(message, {
      from: "website@example.com",
      to: "contact-team@example.com",
      replyTo: "pat@example.com",
      subject: "New contact form submission",
      text: [
        "Name: Pat Smith",
        "Email: pat@example.com",
        "Message: Please call me.",
        "",
        "—",
        "Sent automatically by the backpackkidz.com website.",
      ].join("\n"),
    });
    assert.equal("raw" in message, false);
    assert.equal("attachments" in message, false);
    assert.equal("path" in message, false);
    assert.equal("href" in message, false);
  } finally {
    nodemailer.createTransport = originalCreateTransport;

    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("Nodemailer composes the notification message without a network connection", async () => {
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const info = await transporter.sendMail({
    from: "website@example.com",
    to: "contact-team@example.com",
    replyTo: "pat@example.com",
    subject: "New contact form submission",
    text: "Name: Pat Smith\nEmail: pat@example.com\nMessage: Please call me.",
  });
  const message = info.message.toString("utf8");

  assert.deepEqual(info.envelope, {
    from: "website@example.com",
    to: ["contact-team@example.com"],
  });
  assert.match(message, /^From: website@example\.com$/m);
  assert.match(message, /^To: contact-team@example\.com$/m);
  assert.match(message, /^Reply-To: pat@example\.com$/m);
  assert.match(message, /^Subject: New contact form submission$/m);
  assert.match(message, /Name: Pat Smith/);
  assert.match(message, /Message: Please call me\./);
});
