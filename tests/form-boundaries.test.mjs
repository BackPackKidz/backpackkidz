import assert from "node:assert/strict";
import test from "node:test";
import { createContactRecord } from "../netlify/contact-utils.mjs";
import { createPartnerRecord } from "../netlify/partner-utils.mjs";
import { createSponsorshipRecord, COST_PER_CHILD } from "../netlify/sponsorship-utils.mjs";
import { createVolunteerRecord } from "../netlify/volunteer-utils.mjs";

const NOW = new Date("2026-08-28T12:00:00.000Z");

test("contact form contract still accepts its required fields", () => {
  const result = createContactRecord(
    { name: "Site Tester", email: "TEST@example.org", message: "Please send information." },
    NOW
  );
  assert.equal(result.error, undefined);
  assert.equal(result.record.email, "test@example.org");
  assert.equal(result.record.submittedAt, NOW.toISOString());
});

test("volunteer form contract still accepts its required fields", () => {
  const result = createVolunteerRecord(
    { firstName: "Site", lastName: "Tester", email: "volunteer@example.org" },
    NOW
  );
  assert.equal(result.error, undefined);
  assert.equal(result.record.firstName, "Site");
});

test("sponsorship form contract preserves the confirmed annual amount", () => {
  const result = createSponsorshipRecord(
    { sponsorName: "Site Tester", email: "sponsor@example.org", numberOfChildren: "2" },
    NOW
  );
  assert.equal(COST_PER_CHILD, 320);
  assert.equal(result.error, undefined);
  assert.equal(result.record.totalAmount, 640);
});

test("partner form contract still accepts its required fields", () => {
  const result = createPartnerRecord(
    {
      organizationName: "Example Organization",
      contactName: "Site Tester",
      email: "partner@example.org",
    },
    NOW
  );
  assert.equal(result.error, undefined);
  assert.equal(result.record.organizationName, "Example Organization");
});

test("all non-donation forms still fail closed on missing required fields", () => {
  assert.deepEqual(createContactRecord({}, NOW).fields, ["name", "email", "message"]);
  assert.deepEqual(createVolunteerRecord({}, NOW).fields, ["firstName", "lastName", "email"]);
  assert.deepEqual(createSponsorshipRecord({}, NOW).fields, ["sponsorName", "email", "numberOfChildren"]);
  assert.deepEqual(createPartnerRecord({}, NOW).fields, ["organizationName", "contactName", "email"]);
});
