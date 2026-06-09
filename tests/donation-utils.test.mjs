import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDonationRecord,
  flattenDonationRecord,
  recordsToCsv,
} from "../netlify/donation-utils.mjs";

test("creates a pending PayPal donation record with thank-you tracking", () => {
  const result = createDonationRecord(
    {
      donor_type: "Individual",
      donor_name: "Jane Donor",
      email: "Jane@example.com",
      amount: "25.50",
      address: "123 Main Street",
      wants_thank_you_gift_or_card: true,
      public_recognition_allowed: true,
      source_campaign: "Website Donation",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );

  assert.equal(result.errors, undefined);
  assert.equal(result.record.donor.email, "jane@example.com");
  assert.equal(result.record.donation.amount, 25.5);
  assert.equal(result.record.donation.payment_provider, "PayPal");
  assert.equal(result.record.donation.payment_status, "pending_payment");
  assert.equal(result.record.thank_you_tracking.thank_you_card_needed, true);
  assert.equal(result.record.thank_you_tracking.thank_you_gift_needed, true);
});

test("rejects missing identity, invalid email, and non-positive amount", () => {
  const result = createDonationRecord({
    donor_type: "Individual",
    email: "not-an-email",
    amount: "0",
  });

  assert.equal(result.errors.length, 3);
  assert.deepEqual(
    result.errors.map((error) => error.field),
    ["donor_name", "email", "amount"]
  );
});

test("requires honoree name when honor or memory option is selected", () => {
  const result = createDonationRecord({
    donor_type: "Business",
    business_or_organization_name: "Local Helper LLC",
    email: "hello@example.com",
    amount: "100",
    in_honor_enabled: true,
    honor_type: "in memory of",
  });

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "honoree_name");
});

test("exports donation records as escaped CSV", () => {
  const { record } = createDonationRecord(
    {
      donor_type: "Organization",
      business_or_organization_name: "Friends, Inc.",
      email: "friends@example.com",
      amount: "10",
      in_honor_enabled: true,
      honoree_name: "A Kind Neighbor",
      honor_message: "Thank you, always.",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );

  const csv = recordsToCsv([record]);
  const flat = flattenDonationRecord(record);

  assert.match(csv, /"Friends, Inc\."/);
  assert.equal(flat.payment_status, "pending_payment");
  assert.equal(flat.in_honor_enabled, true);
});
