import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDonationRecord,
  donationHonorSummary,
  recordsToCsv,
} from "../netlify/donation-utils.mjs";

test("creates a flat donation record with all submitted fields", () => {
  const result = createDonationRecord(
    {
      donorType: "Individual",
      amount: "25.50",
      donorName: "Jane Donor",
      organizationName: "Jane's Helpers",
      email: "Jane@example.com",
      phone: "555-0100",
      mailingAddress: "123 Main Street",
      city: "Punta Gorda",
      state: "FL",
      zip: "33950",
      sourceCampaign: "Website Donation",
      inHonorMemory: true,
      honorType: "in honor of",
      honoreeName: "A Kind Teacher",
      honorMessage: "Thank you.",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );

  assert.equal(result.error, undefined);
  assert.match(result.record.id, /^[0-9a-f-]{36}$/i);
  assert.equal(result.record.submittedAt, "2026-06-09T12:00:00.000Z");
  assert.equal(result.record.donorType, "Individual");
  assert.equal(result.record.amount, 25.5);
  assert.equal(result.record.donorName, "Jane Donor");
  assert.equal(result.record.organizationName, "Jane's Helpers");
  assert.equal(result.record.email, "jane@example.com");
  assert.equal(result.record.phone, "555-0100");
  assert.equal(result.record.mailingAddress, "123 Main Street");
  assert.equal(result.record.city, "Punta Gorda");
  assert.equal(result.record.state, "FL");
  assert.equal(result.record.zip, "33950");
  assert.equal(result.record.sourceCampaign, "Website Donation");
  assert.equal(result.record.inHonorMemory, true);
  assert.equal(result.record.honorType, "in honor of");
  assert.equal(result.record.honoreeName, "A Kind Teacher");
  assert.equal(result.record.honorMessage, "Thank you.");
});

test("allows donor email to be omitted", () => {
  const result = createDonationRecord({
    donorType: "Business",
    organizationName: "Local Helper LLC",
    amount: "100",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.record.email, "");
  assert.equal(result.record.amount, 100);
});

test("stores a missing or invalid amount as blank instead of rejecting", () => {
  assert.equal(createDonationRecord({ donorName: "Jane" }).record.amount, "");
  assert.equal(
    createDonationRecord({ donorName: "Jane", amount: "0" }).record.amount,
    ""
  );
  assert.equal(
    createDonationRecord({ donorName: "Jane", amount: "abc" }).record.amount,
    ""
  );
  assert.equal(
    createDonationRecord({ donorName: "Jane", amount: "$25.50" }).record.amount,
    25.5
  );
});

test("accepts a completely empty submission (no required fields)", () => {
  const result = createDonationRecord({});

  assert.equal(result.error, undefined);
  assert.equal(result.record.status, "Pending");
  assert.equal(result.record.donorName, "");
  assert.equal(result.record.amount, "");
});

test("still flags a malformed email when one is entered", () => {
  const result = createDonationRecord({ email: "not-an-email" });

  assert.equal(result.error, "Please double-check the highlighted fields.");
  assert.deepEqual(result.fields, ["email"]);
});

test("new donation records start as Pending with empty bookkeeping fields", () => {
  const { record } = createDonationRecord({
    donorType: "Individual",
    donorName: "Jane Donor",
    amount: "25",
  });

  assert.equal(record.status, "Pending");
  assert.equal(record.paypalTxnId, "");
  assert.equal(record.paidAmount, "");
  assert.equal(record.payerEmail, "");
  assert.equal(record.completedAt, "");
});

test("summarizes honor details for bookkeeping and emails", () => {
  assert.equal(
    donationHonorSummary({
      inHonorMemory: true,
      honorType: "in memory of",
      honoreeName: "A Kind Teacher",
      honorMessage: "Thank you.",
    }),
    "in memory of A Kind Teacher — Thank you."
  );
  assert.equal(
    donationHonorSummary({ inHonorMemory: true, honoreeName: "A Friend" }),
    "in honor of A Friend"
  );
  assert.equal(donationHonorSummary({ inHonorMemory: false }), "");
});

test("exports flat donation records as escaped CSV", () => {
  const { record } = createDonationRecord(
    {
      donorType: "Organization",
      organizationName: "Friends, Inc.",
      amount: "10",
      inHonorMemory: true,
      honoreeName: "A Kind Neighbor",
      honorMessage: "Thank you, always.",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );

  const csv = recordsToCsv([record]);

  assert.match(csv, /^id,submittedAt,donorType,amount,donorName,/);
  assert.match(csv, /"Friends, Inc\."/);
  assert.match(csv, /"Thank you, always\."/);
});
