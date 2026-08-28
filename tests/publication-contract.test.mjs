import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  fileDigest,
  proposalDigest,
  publicUrlForSlot,
  readSlotFromSource,
  resolveSlotPath,
  textDigest,
  validateCandidateDiff,
  validateProposal,
  verifyProposalInSource,
} from "../scripts/publication-contract.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const BASE = {
  head: "65c57a2a0b24841663800106a17a8570736eccef",
  tree: "39829fe652d4f59207976bd6e201b5268c321b43",
};
const GOVERNED_BASE = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: ROOT, encoding: "utf8" }).trim(),
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
const immutableHomeSource = () =>
  execFileSync("git", ["show", `${GOVERNED_BASE.tree}:${SLOT_DEFINITIONS["home.hero.summary"].file}`], {
    cwd: ROOT,
    encoding: "utf8",
  });

test("reads normalized public text without hardcoding mutable slot copy", () => {
  const fixture = `<!-- governed-publication:home.hero.summary:start -->
    Public &amp; normalized fixture text.
  <!-- governed-publication:home.hero.summary:end -->`;
  assert.equal(
    readSlotFromSource(fixture, "home.hero.summary"),
    "Public & normalized fixture text."
  );
  assert.ok(readSlotFromSource(homeSource(), "home.hero.summary").length > 0);
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

  for (const inheritedName of ["toString", "constructor", "__proto__"]) {
    assert.throws(
      () => validateProposal({ ...proposal, operation: { ...proposal.operation, slot: inheritedName } }),
      /not allowlisted/u
    );
  }
});

test("rejects an allowlisted path routed through a symbolic link or reparse point", () => {
  const parent = mkdtempSync(join(tmpdir(), "bpk-publication-path-"));
  const root = join(parent, "repo");
  const outside = join(parent, "outside");

  try {
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(outside, "index.html"), "outside", "utf8");
    symlinkSync(outside, join(root, "BackPackKidzWebsite"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(
      () => resolveSlotPath(root, "home.hero.summary"),
      /symbolic links or reparse points/u
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("rejects an allowlisted target hard-linked to another file", () => {
  const parent = mkdtempSync(join(tmpdir(), "bpk-publication-hardlink-"));
  const root = join(parent, "repo");
  const outside = join(parent, "outside.html");

  try {
    mkdirSync(join(root, "BackPackKidzWebsite"), { recursive: true });
    writeFileSync(outside, "outside", "utf8");
    linkSync(outside, join(root, "BackPackKidzWebsite", "index.html"));
    assert.throws(
      () => resolveSlotPath(root, "home.hero.summary"),
      /single-link regular file/u
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
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

test("preserves checkout line endings while keeping a Git-canonical file identity", () => {
  const proposal = proposalFor();
  const lfSource = homeSource().replace(/\r\n/gu, "\n");
  const crlfSource = lfSource.replace(/\n/gu, "\r\n");
  const result = applyProposalToSource(crlfSource, proposal);

  assert.equal(result.replace(/\r\n/gu, "").includes("\n"), false);
  assert.equal(fileDigest(result), fileDigest(result.replace(/\r\n/gu, "\n")));
});

test("verification catches a wrong result", () => {
  const proposal = proposalFor();
  assert.throws(() => verifyProposalInSource(homeSource(), proposal), /Verification failed/u);
});

test("a guarded inverse proposal restores the previous public value", () => {
  const proposal = proposalFor({ base: GOVERNED_BASE });
  const beforeSource = homeSource();
  const immutableBeforeSource = immutableHomeSource();
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
      head: proposal.base.head,
      tree: proposal.base.tree,
      file: SLOT_DEFINITIONS[proposal.operation.slot].file,
      fileSha256: fileDigest(immutableBeforeSource),
      textSha256: textDigest(beforeValue),
    },
    result: {
      file: SLOT_DEFINITIONS[proposal.operation.slot].file,
      fileSha256: fileDigest(afterSource),
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
        root: ROOT,
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
        root: ROOT,
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
        root: ROOT,
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
        root: ROOT,
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

  assert.throws(
    () =>
      createRollbackProposal({
        root: ROOT,
        receipt: {
          ...receipt,
          source: {
            ...receipt.source,
            textSha256: textDigest("Attacker-selected replacement text."),
          },
          rollback: {
            ...receipt.rollback,
            restoreValue: "Attacker-selected replacement text.",
          },
        },
        base: BASE,
        proposalId: "pub-rollback-coordinated-tamper",
        now: new Date("2026-08-28T12:04:00.000Z"),
      }),
    /does not match the immutable Git source/u
  );

  const rollback = createRollbackProposal({
    root: ROOT,
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

test("candidate check binds an exact two-file diff and rejects a direct slot edit", () => {
  const parent = mkdtempSync(join(tmpdir(), "bpk-publication-candidate-"));
  const root = join(parent, "repo");
  const targetFile = SLOT_DEFINITIONS["home.hero.summary"].file;
  const baseSource = `<!doctype html>\n<!-- governed-publication:home.hero.summary:start -->\n  Original governed text.\n<!-- governed-publication:home.hero.summary:end -->\n`;
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

  try {
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "BackPackKidzWebsite"), { recursive: true });
    writeFileSync(join(root, "scripts", "publication-contract.mjs"), "trusted contract baseline\n", "utf8");
    writeFileSync(join(root, targetFile), baseSource, "utf8");
    git(["init", "-b", "main"]);
    git(["config", "user.name", "Publication Test"]);
    git(["config", "user.email", "publication-test@example.invalid"]);
    git(["add", "."]);
    git(["commit", "-m", "base"]);

    const base = { head: git(["rev-parse", "HEAD"]), tree: git(["rev-parse", "HEAD^{tree}"]) };
    const proposal = createProposal({
      proposalId: "pub-candidate-check-test",
      base,
      slot: "home.hero.summary",
      value: "Exact reviewed candidate text.",
      now: CREATED_AT,
    });
    const resultSource = applyProposalToSource(baseSource, proposal);
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
        head: base.head,
        tree: base.tree,
        file: targetFile,
        fileSha256: fileDigest(baseSource),
        textSha256: textDigest("Original governed text."),
      },
      result: {
        file: targetFile,
        fileSha256: fileDigest(resultSource),
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
        restoreValue: "Original governed text.",
      },
      materializedAt,
    };

    mkdirSync(join(root, "publication", "audit"), { recursive: true });
    writeFileSync(join(root, targetFile), resultSource, "utf8");
    writeFileSync(
      join(root, "publication", "audit", `${proposal.proposalId}.json`),
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8"
    );
    git(["add", "."]);
    git(["commit", "-m", "candidate"]);
    const candidateHead = git(["rev-parse", "HEAD"]);

    assert.equal(
      validateCandidateDiff(root, { base: base.head, head: candidateHead }).mode,
      "governed-publication-candidate"
    );

    git(["checkout", "-b", "direct-edit", base.head]);
    writeFileSync(join(root, targetFile), baseSource.replace("Original governed text.", "Unreceipted direct edit."), "utf8");
    git(["add", targetFile]);
    git(["commit", "-m", "direct edit"]);
    const directHead = git(["rev-parse", "HEAD"]);

    assert.throws(
      () => validateCandidateDiff(root, { base: base.head, head: directHead }),
      /exactly one allowlisted slot file and add exactly one receipt/u
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
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
