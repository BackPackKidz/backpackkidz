import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

export const CONTRACT_VERSION = 1;
export const REPOSITORY = "BackPackKidz/backpackkidz";
export const ALLOWED_OPERATION = "set_public_text";

export const SLOT_DEFINITIONS = Object.freeze({
  "home.hero.summary": Object.freeze({
    file: "BackPackKidzWebsite/index.html",
    description: "Home-page hero supporting sentence",
    maxLength: 280,
  }),
  "events.featured.summary": Object.freeze({
    file: "BackPackKidzWebsite/pages/future-events.html",
    description: "Featured-event hero summary",
    maxLength: 500,
  }),
});

const TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "proposalId",
  "repository",
  "base",
  "operation",
  "createdAt",
  "rationale",
]);
const BASE_KEYS = new Set(["head", "tree"]);
const OPERATION_KEYS = new Set(["type", "slot", "value"]);
const RECEIPT_KEYS = new Set([
  "schemaVersion",
  "kind",
  "proposal",
  "proposalId",
  "proposalDigest",
  "operation",
  "source",
  "result",
  "verification",
  "publicationAuthority",
  "rollback",
  "materializedAt",
]);

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CREDENTIALS)[A-Z0-9 ]*-----/i,
  /\b(?:sk|rk|pk)-(?:live|test|proj)-[A-Za-z0-9_-]{12,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bAIza[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:api[_ -]?key|client[_ -]?secret|password|passwd|access[_ -]?token|auth[_ -]?token|private[_ -]?key|credential)\s*[:=]\s*\S+/i,
  /\b[A-Za-z0-9_+/=-]{48,}\b/,
];

const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const stableValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }

  return value;
};

export const canonicalJson = (value) => JSON.stringify(stableValue(value));
export const proposalDigest = (proposal) => `sha256:${sha256(canonicalJson(proposal))}`;
export const textDigest = (value) => `sha256:${sha256(value)}`;

const fail = (message) => {
  throw new Error(message);
};

const assertPlainObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
};

const assertOnlyKeys = (value, allowed, label) => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail(`${label} contains unsupported field "${key}".`);
    }
  }
};

const normalizePublicText = (value) => {
  if (typeof value !== "string") {
    fail("operation.value must be a string.");
  }

  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();

  if (!normalized) {
    fail("operation.value must not be empty.");
  }

  if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    fail("operation.value contains a control character.");
  }

  if (/[<>]/u.test(normalized)) {
    fail("operation.value must be plain text; markup is not allowed.");
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(normalized)) {
      fail("operation.value resembles a credential or secret and is not allowed.");
    }
  }

  return normalized;
};

const assertSafeRationale = (value) => {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.length > 500) {
    fail("rationale must be a string of at most 500 characters.");
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(value)) {
      fail("rationale resembles a credential or secret and is not allowed.");
    }
  }
};

export const validateProposal = (proposal) => {
  assertPlainObject(proposal, "proposal");
  assertOnlyKeys(proposal, TOP_LEVEL_KEYS, "proposal");

  if (proposal.schemaVersion !== CONTRACT_VERSION) {
    fail(`schemaVersion must be ${CONTRACT_VERSION}.`);
  }

  if (
    typeof proposal.proposalId !== "string" ||
    !/^pub-[a-z0-9][a-z0-9-]{5,63}$/u.test(proposal.proposalId)
  ) {
    fail("proposalId must match pub-[a-z0-9][a-z0-9-]{5,63}.");
  }

  if (proposal.repository !== REPOSITORY) {
    fail(`repository must be exactly ${REPOSITORY}.`);
  }

  assertPlainObject(proposal.base, "base");
  assertOnlyKeys(proposal.base, BASE_KEYS, "base");

  for (const key of ["head", "tree"]) {
    if (typeof proposal.base[key] !== "string" || !/^[a-f0-9]{40}$/u.test(proposal.base[key])) {
      fail(`base.${key} must be a 40-character lowercase Git object ID.`);
    }
  }

  assertPlainObject(proposal.operation, "operation");
  assertOnlyKeys(proposal.operation, OPERATION_KEYS, "operation");

  if (proposal.operation.type !== ALLOWED_OPERATION) {
    fail(`operation.type must be exactly ${ALLOWED_OPERATION}.`);
  }

  const slot = SLOT_DEFINITIONS[proposal.operation.slot];

  if (!slot) {
    fail(`operation.slot is not allowlisted. Allowed slots: ${Object.keys(SLOT_DEFINITIONS).join(", ")}.`);
  }

  const value = normalizePublicText(proposal.operation.value);

  if (value !== proposal.operation.value) {
    fail("operation.value must already be normalized (trimmed with single spaces). Use the propose command.");
  }

  if (value.length > slot.maxLength) {
    fail(`operation.value exceeds the ${slot.maxLength}-character limit for ${proposal.operation.slot}.`);
  }

  if (typeof proposal.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(proposal.createdAt)) {
    fail("createdAt must be an RFC 3339 UTC timestamp.");
  }

  if (Number.isNaN(Date.parse(proposal.createdAt))) {
    fail("createdAt is not a valid timestamp.");
  }

  assertSafeRationale(proposal.rationale);
  return proposal;
};

export const createProposal = ({ proposalId, base, slot, value, rationale, now = new Date() }) => {
  const proposal = {
    schemaVersion: CONTRACT_VERSION,
    proposalId,
    repository: REPOSITORY,
    base,
    operation: {
      type: ALLOWED_OPERATION,
      slot,
      value: normalizePublicText(value),
    },
    createdAt: now.toISOString(),
    ...(rationale ? { rationale: rationale.normalize("NFKC").trim() } : {}),
  };

  return validateProposal(proposal);
};

const marker = (slot, edge) => `<!-- governed-publication:${slot}:${edge} -->`;

const decodeHtmlText = (value) =>
  value
    .replace(/&mdash;/gu, "—")
    .replace(/&ndash;/gu, "–")
    .replace(/&middot;/gu, "·")
    .replace(/&rsquo;/gu, "’")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/gu, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));

const encodeHtmlText = (value) =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");

const locateSlot = (source, slot) => {
  if (!SLOT_DEFINITIONS[slot]) {
    fail(`Unknown publication slot "${slot}".`);
  }

  const startToken = marker(slot, "start");
  const endToken = marker(slot, "end");
  const firstStart = source.indexOf(startToken);
  const firstEnd = source.indexOf(endToken);

  if (firstStart < 0 || firstEnd < 0 || firstEnd <= firstStart) {
    fail(`Slot markers for ${slot} are missing or out of order.`);
  }

  if (source.indexOf(startToken, firstStart + startToken.length) >= 0 || source.indexOf(endToken, firstEnd + endToken.length) >= 0) {
    fail(`Slot markers for ${slot} must occur exactly once.`);
  }

  return {
    startToken,
    endToken,
    contentStart: firstStart + startToken.length,
    contentEnd: firstEnd,
    markerStart: firstStart,
  };
};

export const readSlotFromSource = (source, slot) => {
  const location = locateSlot(source, slot);
  const inner = source.slice(location.contentStart, location.contentEnd).trim();

  if (/<\/?[A-Za-z][^>]*>/u.test(inner)) {
    fail(`Slot ${slot} contains markup; governed slots must contain text only.`);
  }

  return decodeHtmlText(inner).replace(/\s+/gu, " ").trim();
};

const wrapText = (value, width) => {
  const words = value.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
};

export const applyProposalToSource = (source, proposal) => {
  validateProposal(proposal);
  const { slot, value } = proposal.operation;
  const location = locateSlot(source, slot);
  const lineStart = source.lastIndexOf("\n", location.markerStart) + 1;
  const indentation = source.slice(lineStart, location.markerStart);

  if (!/^\s*$/u.test(indentation)) {
    fail(`Slot ${slot} start marker must be on its own line.`);
  }

  const textIndentation = `${indentation}  `;
  const rendered = wrapText(encodeHtmlText(value), Math.max(40, 88 - textIndentation.length))
    .map((line) => `${textIndentation}${line}`)
    .join("\n");
  const replacement = `\n${rendered}\n${indentation}`;
  const nextSource = `${source.slice(0, location.contentStart)}${replacement}${source.slice(location.contentEnd)}`;

  if (readSlotFromSource(nextSource, slot) !== value) {
    fail("Deterministic materialization verification failed.");
  }

  return nextSource;
};

const resolveSlotPath = (root, slot) => {
  const rootPath = resolve(root);
  const filePath = resolve(rootPath, SLOT_DEFINITIONS[slot].file);

  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
    fail("Resolved publication path escaped the repository root.");
  }

  return filePath;
};

export const readSlot = (root, slot) => {
  const file = SLOT_DEFINITIONS[slot]?.file;

  if (!file) {
    fail(`Unknown publication slot "${slot}".`);
  }

  const source = readFileSync(resolveSlotPath(root, slot), "utf8");
  return {
    slot,
    file,
    value: readSlotFromSource(source, slot),
    sourceSha256: textDigest(source),
  };
};

export const getGitIdentity = (root) => ({
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).trim(),
});

export const assertBaseIdentity = (proposal, actualBase) => {
  validateProposal(proposal);

  if (proposal.base.head !== actualBase.head || proposal.base.tree !== actualBase.tree) {
    fail(
      `Proposal base is stale. Expected ${proposal.base.head}/${proposal.base.tree}; current base is ${actualBase.head}/${actualBase.tree}.`
    );
  }
};

const gitOutput = (root, args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

export const assertMaterializationContext = (root, proposal) => {
  assertBaseIdentity(proposal, getGitIdentity(root));
  const branch = gitOutput(root, ["branch", "--show-current"]);

  if (!branch || branch === "main" || branch === "master") {
    fail("Candidate materialization is forbidden on the default branch or detached HEAD.");
  }

  if (gitOutput(root, ["status", "--porcelain"])) {
    fail("Candidate materialization requires a clean worktree.");
  }

  const remote = gitOutput(root, ["remote", "get-url", "origin"]);

  if (!/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)?BackPackKidz\/backpackkidz(?:\.git)?$/iu.test(remote)) {
    fail(`origin does not identify ${REPOSITORY}.`);
  }

  return { branch };
};

export const previewProposal = (root, proposal) => {
  validateProposal(proposal);
  assertBaseIdentity(proposal, getGitIdentity(root));
  const slotStatus = gitOutput(root, [
    "status",
    "--porcelain",
    "--",
    SLOT_DEFINITIONS[proposal.operation.slot].file,
  ]);

  if (slotStatus) {
    fail("Preview requires the governed slot file to match the proposal base exactly.");
  }

  const current = readSlot(root, proposal.operation.slot);

  if (current.value === proposal.operation.value) {
    fail("Proposal has no effect: before and after values are identical.");
  }

  return {
    proposalId: proposal.proposalId,
    proposalDigest: proposalDigest(proposal),
    repository: REPOSITORY,
    base: proposal.base,
    operation: proposal.operation.type,
    slot: proposal.operation.slot,
    file: current.file,
    before: current.value,
    after: proposal.operation.value,
  };
};

export const formatPreview = (preview) => [
  `Proposal: ${preview.proposalId}`,
  `Identity: ${preview.proposalDigest}`,
  `Repository: ${preview.repository}`,
  `Base HEAD: ${preview.base.head}`,
  `Base TREE: ${preview.base.tree}`,
  `Operation: ${preview.operation}`,
  `Slot: ${preview.slot}`,
  `File: ${preview.file}`,
  "",
  "BEFORE",
  preview.before,
  "",
  "AFTER",
  preview.after,
  "",
  "This command only previews a candidate. Publication requires authenticated GitHub PR approval and merge.",
].join("\n");

export const verifyProposalInSource = (source, proposal) => {
  validateProposal(proposal);
  const actual = readSlotFromSource(source, proposal.operation.slot);

  if (actual !== proposal.operation.value) {
    fail(
      `Verification failed for ${proposal.operation.slot}: expected ${textDigest(proposal.operation.value)}, received ${textDigest(actual)}.`
    );
  }

  return { status: "passed", actualTextSha256: textDigest(actual) };
};

export const materializeProposal = (root, proposal, now = new Date()) => {
  const context = assertMaterializationContext(root, proposal);
  const preview = previewProposal(root, proposal);
  const filePath = resolveSlotPath(root, proposal.operation.slot);
  const beforeSource = readFileSync(filePath, "utf8");
  const afterSource = applyProposalToSource(beforeSource, proposal);
  const verification = verifyProposalInSource(afterSource, proposal);
  const materializedAt = now.toISOString();
  const receiptPath = resolve(root, "publication", "audit", `${proposal.proposalId}.json`);

  if (existsSync(receiptPath)) {
    fail(`Audit receipt already exists for proposal ${proposal.proposalId}; proposal identities are immutable.`);
  }

  const receipt = {
    schemaVersion: CONTRACT_VERSION,
    kind: "governed-publication-candidate-receipt",
    proposal,
    proposalId: proposal.proposalId,
    proposalDigest: proposalDigest(proposal),
    operation: proposal.operation,
    source: {
      repository: REPOSITORY,
      head: proposal.base.head,
      tree: proposal.base.tree,
      file: preview.file,
      fileSha256: textDigest(beforeSource),
      textSha256: textDigest(preview.before),
    },
    result: {
      file: preview.file,
      fileSha256: textDigest(afterSource),
      textSha256: textDigest(preview.after),
    },
    verification: {
      status: verification.status,
      verifiedAt: materializedAt,
    },
    publicationAuthority: {
      boundary: "authenticated-github-pull-request-review-and-merge",
      status: "pending-human-approval",
      actorReference: "recorded by GitHub on review and merge",
    },
    rollback: {
      type: "inverse_set_public_text_through_new_pull_request",
      expectedCurrentTextSha256: textDigest(preview.after),
      restoreValue: preview.before,
    },
    materializedAt,
  };
  writeFileSync(filePath, afterSource, "utf8");
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  return { branch: context.branch, preview, receipt, receiptPath };
};

export const validateReceipt = (receipt) => {
  assertPlainObject(receipt, "receipt");
  assertOnlyKeys(receipt, RECEIPT_KEYS, "receipt");

  if (receipt.schemaVersion !== CONTRACT_VERSION || receipt.kind !== "governed-publication-candidate-receipt") {
    fail("Unsupported publication receipt.");
  }

  validateProposal(receipt.proposal);

  if (receipt.proposalId !== receipt.proposal.proposalId) {
    fail("Receipt proposalId does not match the embedded proposal.");
  }

  if (canonicalJson(receipt.operation) !== canonicalJson(receipt.proposal.operation)) {
    fail("Receipt operation does not match the embedded proposal.");
  }

  if (
    receipt.source?.repository !== receipt.proposal.repository ||
    receipt.source?.head !== receipt.proposal.base.head ||
    receipt.source?.tree !== receipt.proposal.base.tree
  ) {
    fail("Receipt source identity does not match the embedded proposal.");
  }

  if (receipt.proposalDigest !== proposalDigest(receipt.proposal)) {
    fail("Receipt proposal digest does not match the embedded proposal.");
  }

  if (receipt.result?.file !== SLOT_DEFINITIONS[receipt.operation.slot].file || receipt.source?.file !== receipt.result.file) {
    fail("Receipt file does not match the allowlisted slot path.");
  }

  if (receipt.rollback?.restoreValue !== normalizePublicText(receipt.rollback?.restoreValue)) {
    fail("Receipt rollback value is malformed.");
  }

  return receipt;
};

export const createRollbackProposal = ({ receipt, base, proposalId, now = new Date() }) => {
  validateReceipt(receipt);

  if (receipt.rollback.expectedCurrentTextSha256 !== receipt.result.textSha256) {
    fail("Receipt rollback guard does not match the recorded result.");
  }

  return createProposal({
    proposalId,
    base,
    slot: receipt.operation.slot,
    value: receipt.rollback.restoreValue,
    rationale: `Rollback of ${receipt.proposalId}.`,
    now,
  });
};

export const verifyReceiptInRoot = (root, receipt) => {
  validateReceipt(receipt);
  const current = readSlot(root, receipt.operation.slot);

  if (current.value !== receipt.operation.value) {
    fail(`Verification failed: current slot value does not match receipt ${receipt.proposalId}.`);
  }

  if (current.sourceSha256 !== receipt.result.fileSha256) {
    fail(`Verification failed: current file identity does not match receipt ${receipt.proposalId}.`);
  }

  return {
    status: "passed",
    proposalId: receipt.proposalId,
    file: current.file,
    fileSha256: current.sourceSha256,
    textSha256: textDigest(current.value),
  };
};

export const allowedCommands = Object.freeze([
  "read",
  "propose",
  "validate",
  "preview",
  "materialize",
  "verify",
  "verify-live",
  "rollback-preview",
]);

export const assertAllowedCommand = (command) => {
  if (!allowedCommands.includes(command)) {
    fail(`Unsupported command "${command}". This tool has no publish, deploy, merge, or arbitrary-file command.`);
  }

  return command;
};

export const loadJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export const publicUrlForSlot = (baseUrl, slot) => {
  const definition = SLOT_DEFINITIONS[slot];

  if (!definition) {
    fail(`Unknown publication slot "${slot}".`);
  }

  const url = new URL(baseUrl);

  if (url.protocol !== "https:") {
    fail("Live verification requires HTTPS.");
  }

  const allowedHost =
    url.hostname === "www.backpackkidz.com" ||
    url.hostname === "backpackkidz.com" ||
    url.hostname === "backpackkidz.netlify.app" ||
    /^deploy-preview-[1-9]\d*--backpackkidz\.netlify\.app$/u.test(url.hostname);

  if (!allowedHost || url.username || url.password || url.port) {
    fail("Live verification URL must identify an approved Back Pack Kidz production or deploy-preview host without userinfo or a non-default port.");
  }

  const relative = definition.file
    .replace(/^BackPackKidzWebsite\//u, "")
    .replace(/index\.html$/u, "")
    .replace(/\.html$/u, "");
  return new URL(relative, `${url.origin}/`).toString();
};

export { normalizePublicText, sha256 };
