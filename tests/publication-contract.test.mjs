import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  ALLOWED_OPERATION,
  REPOSITORY,
  SLOT_DEFINITIONS,
  applyProposalToSource,
  assertAllowedCommand,
  assertBaseIdentity,
  createProposal,
  createRollbackProposal,
  fetchPublicSlotResponse,
  proposalDigest,
  publicUrlForSlot,
  readSlotFromSource,
  textDigest,
  validateProposal,
  verifyProposalInSource,
} from "../scripts/publication-contract.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const BASE = {
  head: "65c57a2a0b24841663800106a17a8570736eccef",
  tree: "39829fe652d4f59207976bd6e201b5268c321b43",
};
const CREATED_AT = new Date("2026-08-28T12:00:00.000Z");

const proposalFor = (overrides = {}) =>
  createProposal({
    proposalId: "pub-home-summary-test",
    base: BASE,
    slot: "home.hero.summary",
    value: "A reviewed, public-safe sentence for Charlotte County families.",
    now: CREATED_AT,
    ...overrides,
  });

const homeSource = () => readFileSync(join(ROOT, SLOT_DEFINITIONS["home.hero.summary"].file), "utf8");

test("reads the exact current public text from an allowlisted slot", () => {
  assert.equal(
    readSlotFromSource(homeSource(), "home.hero.summary"),
    "Feeding children in Charlotte County when school meals aren't available — because no child should go hungry on the weekend."
  );
});

test("rejects a stale or changed base identity", () => {
  const proposal = proposalFor();
  assert.throws(
    () => assertBaseIdentity(proposal, { ...BASE, head: "a".repeat(40) }),
    /Proposal base is stale/u
  );
});

test("has no local publish, deploy, merge, or execute command", () => {
  for (const command of ["publish", "deploy", "merge", "execute"]) {
    assert.throws(() => assertAllowedCommand(command), /no publish, deploy, merge, or arbitrary-file command/u);
  }
});

test("rejects malformed proposals and unknown fields", () => {
  const proposal = proposalFor();
  assert.throws(() => validateProposal({ ...proposal, schemaVersion: 99 }), /schemaVersion/u);
  assert.throws(() => validateProposal({ ...proposal, approval: true }), /unsupported field "approval"/u);
  assert.throws(
    () => validateProposal({ ...proposal, operation: { ...proposal.operation, path: "BackPackKidzWebsite/index.html" } }),
    /unsupported field "path"/u
  );
});

test("rejects operations outside the closed allowlist", () => {
  const proposal = proposalFor();
  assert.throws(
    () => validateProposal({ ...proposal, operation: { ...proposal.operation, type: "replace_file" } }),
    /operation.type must be exactly/u
  );
  assert.throws(
    () => validateProposal({ ...proposal, operation: { ...proposal.operation, slot: "donate.paypal.url" } }),
    /not allowlisted/u
  );
});

test("makes payment mutation and arbitrary file targeting impossible through the contract", () => {
  assert.equal(ALLOWED_OPERATION, "set_public_text");
  assert.ok(
    Object.values(SLOT_DEFINITIONS).every(
      ({ file }) => !/donat|paypal|netlify\/functions/iu.test(file)
    )
  );

  const proposal = proposalFor();
  assert.throws(
    () => validateProposal({ ...proposal, operation: { ...proposal.operation, slot: "../../netlify/functions/paypal-ipn.js" } }),
    /not allowlisted/u
  );
});

test("rejects markup and credential-shaped publication content", () => {
  assert.throws(
    () => proposalFor({ value: "Visit <script>alert(1)</script>" }),
    /markup is not allowed/u
  );
  assert.throws(
    () => proposalFor({ value: "api_key=abcdefghijklmnopqrstuvwxyz0123456789" }),
    /credential or secret/u
  );
  assert.throws(
    () => proposalFor({ value: "-----BEGIN PRIVATE KEY----- abc" }),
    /credential or secret/u
  );
});

test("materializes an exact proposal deterministically", () => {
  const proposal = proposalFor();
  const first = applyProposalToSource(homeSource(), proposal);
  const second = applyProposalToSource(homeSource(), proposal);

  assert.equal(first, second);
  assert.equal(readSlotFromSource(first, proposal.operation.slot), proposal.operation.value);
  assert.deepEqual(verifyProposalInSource(first, proposal), {
    status: "passed",
    actualTextSha256: textDigest(proposal.operation.value),
  });
});

test("verification catches a wrong result", () => {
  const proposal = proposalFor();
  assert.throws(() => verifyProposalInSource(homeSource(), proposal), /Verification failed/u);
});

test("a guarded inverse proposal restores the previous public value", () => {
  const proposal = proposalFor();
  const beforeSource = homeSource();
  const beforeValue = readSlotFromSource(beforeSource, proposal.operation.slot);
  const afterSource = applyProposalToSource(beforeSource, proposal);
  const materializedAt = CREATED_AT.toISOString();
  const receipt = {
    schemaVersion: 1,
    kind: "governed-publication-candidate-receipt",
    proposal,
    proposalId: proposal.proposalId,
    proposalDigest: proposalDigest(proposal),
    operation: proposal.operation,
    source: {
      repository: REPOSITORY,
      head: BASE.head,
      tree: BASE.tree,
      file: SLOT_DEFINITIONS[proposal.operation.slot].file,
      fileSha256: textDigest(beforeSource),
      textSha256: textDigest(beforeValue),
    },
    result: {
      file: SLOT_DEFINITIONS[proposal.operation.slot].file,
      fileSha256: textDigest(afterSource),
      textSha256: textDigest(proposal.operation.value),
    },
    verification: { status: "passed", verifiedAt: materializedAt },
    publicationAuthority: {
      boundary: "authenticated-github-pull-request-review-and-merge",
      status: "pending-human-approval",
      actorReference: "recorded by GitHub on review and merge",
    },
    rollback: {
      type: "inverse_set_public_text_through_new_pull_request",
      expectedCurrentTextSha256: textDigest(proposal.operation.value),
      restoreValue: beforeValue,
    },
    materializedAt,
  };

  assert.throws(
    () =>
      createRollbackProposal({
        receipt: { ...receipt, proposalDigest: `sha256:${"0".repeat(64)}` },
        base: BASE,
        proposalId: "pub-rollback-tampered-receipt",
        now: new Date("2026-08-28T12:04:00.000Z"),
      }),
    /digest does not match/u
  );

  assert.throws(
    () =>
      createRollbackProposal({
        receipt: {
          ...receipt,
          rollback: { ...receipt.rollback, restoreValue: "Attacker-selected replacement text." },
        },
        base: BASE,
        proposalId: "pub-rollback-altered-value",
        now: new Date("2026-08-28T12:04:00.000Z"),
      }),
    /does not match the recorded source text identity/u
  );

  assert.throws(
    () =>
      createRollbackProposal({
        receipt: {
          ...receipt,
          result: { ...receipt.result, textSha256: textDigest("Unrecorded result.") },
          rollback: { ...receipt.rollback, expectedCurrentTextSha256: textDigest("Unrecorded result.") },
        },
        base: BASE,
        proposalId: "pub-rollback-altered-result",
        now: new Date("2026-08-28T12:04:00.000Z"),
      }),
    /does not match the recorded operation/u
  );

  assert.throws(
    () =>
      createRollbackProposal({
        receipt: {
          ...receipt,
          rollback: { ...receipt.rollback, extraAuthority: true },
        },
        base: BASE,
        proposalId: "pub-rollback-extra-field",
        now: new Date("2026-08-28T12:04:00.000Z"),
      }),
    /unsupported field "extraAuthority"/u
  );

  const rollback = createRollbackProposal({
    receipt,
    base: BASE,
    proposalId: "pub-rollback-home-summary",
    now: new Date("2026-08-28T12:05:00.000Z"),
  });
  const restored = applyProposalToSource(afterSource, rollback);

  assert.equal(readSlotFromSource(restored, rollback.operation.slot), beforeValue);
});

test("proposal identity is stable across object key order", () => {
  const proposal = proposalFor();
  const reordered = {
    createdAt: proposal.createdAt,
    operation: proposal.operation,
    base: proposal.base,
    repository: proposal.repository,
    proposalId: proposal.proposalId,
    schemaVersion: proposal.schemaVersion,
  };
  assert.equal(proposalDigest(proposal), proposalDigest(reordered));
});

test("live verification accepts only exact Back Pack Kidz deployment identities", () => {
  const accepted = [
    "https://backpackkidz.com",
    "https://www.backpackkidz.com",
    "https://backpackkidz.netlify.app",
    "https://deploy-preview-7--backpackkidz.netlify.app",
    "https://deploy-preview-12345--backpackkidz.netlify.app",
  ];

  for (const host of accepted) {
    assert.equal(
      publicUrlForSlot(host, "events.featured.summary"),
      `${host}/pages/future-events`
    );
  }
});

test("live verification rejects unrelated, malformed, and insecure hosts", () => {
  const rejected = [
    "https://evil.netlify.app",
    "https://deploy-preview-7--evil.netlify.app",
    "https://backpackkidz.netlify.app.evil.example",
    "https://deploy-preview-0--backpackkidz.netlify.app",
    "http://backpackkidz.com",
    "https://reviewer@backpackkidz.com",
    "https://reviewer:password@deploy-preview-7--backpackkidz.netlify.app",
    "https://backpackkidz.netlify.app:8443",
  ];

  for (const host of rejected) {
    assert.throws(
      () => publicUrlForSlot(host, "home.hero.summary"),
      /Live verification (?:requires HTTPS|URL must identify an approved Back Pack Kidz)/u
    );
  }
});

test("live verification rejects an unapproved redirect before requesting its destination", async () => {
  const requested = [];
  const fetchImpl = async (url, options) => {
    requested.push({ url, redirect: options.redirect });
    return {
      status: 302,
      url,
      headers: new Headers({ location: "https://evil.netlify.app/pages/future-events" }),
    };
  };

  await assert.rejects(
    fetchPublicSlotResponse(
      "https://deploy-preview-7--backpackkidz.netlify.app",
      "events.featured.summary",
      fetchImpl
    ),
    /approved Back Pack Kidz/u
  );
  assert.deepEqual(requested, [
    {
      url: "https://deploy-preview-7--backpackkidz.netlify.app/pages/future-events",
      redirect: "manual",
    },
  ]);
});

test("live verification follows only an exact governed-slot redirect between approved hosts", async () => {
  const requested = [];
  const fetchImpl = async (url, options) => {
    requested.push({ url, redirect: options.redirect });

    if (requested.length === 1) {
      return {
        status: 301,
        url,
        headers: new Headers({ location: "https://www.backpackkidz.com/pages/future-events" }),
      };
    }

    return { status: 200, ok: true, url, headers: new Headers() };
  };

  const result = await fetchPublicSlotResponse(
    "https://backpackkidz.com",
    "events.featured.summary",
    fetchImpl
  );

  assert.equal(result.url, "https://www.backpackkidz.com/pages/future-events");
  assert.equal(result.response.status, 200);
  assert.deepEqual(requested, [
    { url: "https://backpackkidz.com/pages/future-events", redirect: "manual" },
    { url: "https://www.backpackkidz.com/pages/future-events", redirect: "manual" },
  ]);
});
