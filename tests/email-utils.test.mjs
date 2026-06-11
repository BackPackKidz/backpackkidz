import test from "node:test";
import assert from "node:assert/strict";

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
