import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

const getSlotDefinition = (slot) =>
  typeof slot === "string" && Object.hasOwn(SLOT_DEFINITIONS, slot)
    ? SLOT_DEFINITIONS[slot]
    : undefined;

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
const RECEIPT_SOURCE_KEYS = new Set(["repository", "head", "tree", "file", "fileSha256", "textSha256"]);
const RECEIPT_RESULT_KEYS = new Set(["file", "fileSha256", "textSha256"]);
const RECEIPT_VERIFICATION_KEYS = new Set(["status", "verifiedAt"]);
const RECEIPT_AUTHORITY_KEYS = new Set(["boundary", "status", "actorReference"]);
const RECEIPT_ROLLBACK_KEYS = new Set(["type", "expectedCurrentTextSha256", "restoreValue"]);

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
const normalizeGitText = (value) => value.replace(/\r\n?/gu, "\n");
export const fileDigest = (value) => textDigest(normalizeGitText(value));

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

const assertExactKeys = (value, expected, label) => {
  assertPlainObject(value, label);
  assertOnlyKeys(value, expected, label);

  for (const key of expected) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(`${label} is missing required field "${key}".`);
    }
  }
};

const assertTextDigest = (value, label) => {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    fail(`${label} must be a SHA-256 text identity.`);
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

  const slot = getSlotDefinition(proposal.operation.slot);

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
  if (!getSlotDefinition(slot)) {
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

  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const textIndentation = `${indentation}  `;
  const rendered = wrapText(encodeHtmlText(value), Math.max(40, 88 - textIndentation.length))
    .map((line) => `${textIndentation}${line}`)
    .join(newline);
  const replacement = `${newline}${rendered}${newline}${indentation}`;
  const nextSource = `${source.slice(0, location.contentStart)}${replacement}${source.slice(location.contentEnd)}`;

  if (readSlotFromSource(nextSource, slot) !== value) {
    fail("Deterministic materialization verification failed.");
  }

  return nextSource;
};

const isPathInside = (rootPath, candidatePath) => {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === "" || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
};

const resolveSafeRepositoryPath = (
  root,
  repositoryRelativePath,
  { allowMissing = false, requireDirectory = false, requireFile = false } = {}
) => {
  const rootPath = resolve(root);
  const candidatePath = resolve(rootPath, repositoryRelativePath);

  if (!isPathInside(rootPath, candidatePath)) {
    fail("Resolved publication path escaped the repository root.");
  }

  const relativePath = relative(rootPath, candidatePath);
  let currentPath = rootPath;

  for (const segment of relativePath.split(sep).filter(Boolean)) {
    currentPath = resolve(currentPath, segment);

    if (!existsSync(currentPath)) {
      if (allowMissing) {
        continue;
      }

      fail(`Required publication path does not exist: ${repositoryRelativePath}.`);
    }

    if (lstatSync(currentPath).isSymbolicLink()) {
      fail(`Publication paths must not contain symbolic links or reparse points: ${repositoryRelativePath}.`);
    }
  }

  if (existsSync(candidatePath)) {
    const realRoot = realpathSync(rootPath);
    const realCandidate = realpathSync(candidatePath);
    const candidateStats = lstatSync(candidatePath);

    if (!isPathInside(realRoot, realCandidate)) {
      fail("Canonical publication path escaped the repository root.");
    }

    if (requireFile && (!candidateStats.isFile() || candidateStats.nlink !== 1)) {
      fail(`Governed publication target must be a single-link regular file: ${repositoryRelativePath}.`);
    }

    if (requireDirectory && !candidateStats.isDirectory()) {
      fail(`Governed publication directory is not a directory: ${repositoryRelativePath}.`);
    }
  } else if (!allowMissing) {
    fail(`Required publication path does not exist: ${repositoryRelativePath}.`);
  }

  return candidatePath;
};

export const resolveSlotPath = (root, slot) => {
  const definition = getSlotDefinition(slot);

  if (!definition) {
    fail(`Unknown publication slot "${slot}".`);
  }

  return resolveSafeRepositoryPath(root, definition.file, { requireFile: true });
};

export const readSlot = (root, slot) => {
  const file = getSlotDefinition(slot)?.file;

  if (!file) {
    fail(`Unknown publication slot "${slot}".`);
  }

  const source = readFileSync(resolveSlotPath(root, slot), "utf8");
  return {
    slot,
    file,
    value: readSlotFromSource(source, slot),
    sourceSha256: fileDigest(source),
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

const readImmutableGitSource = (root, { head, tree, file, slot }) => {
  const definition = getSlotDefinition(slot);

  if (!definition || definition.file !== file) {
    fail("Recorded immutable source file does not match the allowlisted slot.");
  }

  let actualTree;

  try {
    actualTree = gitOutput(root, ["rev-parse", `${head}^{tree}`]);
    execFileSync("git", ["merge-base", "--is-ancestor", head, "HEAD"], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    fail("Recorded source HEAD is unavailable or is not an ancestor of the current candidate.");
  }

  if (actualTree !== tree) {
    fail("Recorded source HEAD does not resolve to the recorded source TREE.");
  }

  let source;

  try {
    source = execFileSync("git", ["show", `${tree}:${file}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("Recorded immutable source file is unavailable from the recorded Git tree.");
  }

  return { source, value: readSlotFromSource(source, slot) };
};

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
    getSlotDefinition(proposal.operation.slot).file,
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
  const immutableSource = readImmutableGitSource(root, {
    ...proposal.base,
    file: preview.file,
    slot: proposal.operation.slot,
  });

  if (immutableSource.value !== preview.before) {
    fail("Clean worktree content does not match the proposal's immutable Git source.");
  }

  const materializedAt = now.toISOString();
  const auditDirectory = resolveSafeRepositoryPath(root, "publication/audit", {
    allowMissing: true,
    requireDirectory: true,
  });
  const receiptPath = resolveSafeRepositoryPath(
    root,
    `publication/audit/${proposal.proposalId}.json`,
    { allowMissing: true }
  );

  if (existsSync(receiptPath)) {
    fail(`Audit receipt already exists for proposal ${proposal.proposalId}; proposal identities are immutable.`);
  }

  mkdirSync(auditDirectory, { recursive: true });
  resolveSafeRepositoryPath(root, "publication/audit", { requireDirectory: true });
  resolveSafeRepositoryPath(root, `publication/audit/${proposal.proposalId}.json`, { allowMissing: true });

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
      fileSha256: fileDigest(immutableSource.source),
      textSha256: textDigest(immutableSource.value),
    },
    result: {
      file: preview.file,
      fileSha256: fileDigest(afterSource),
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
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

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

  assertExactKeys(receipt.source, RECEIPT_SOURCE_KEYS, "receipt.source");
  assertExactKeys(receipt.result, RECEIPT_RESULT_KEYS, "receipt.result");
  assertExactKeys(receipt.verification, RECEIPT_VERIFICATION_KEYS, "receipt.verification");
  assertExactKeys(receipt.publicationAuthority, RECEIPT_AUTHORITY_KEYS, "receipt.publicationAuthority");
  assertExactKeys(receipt.rollback, RECEIPT_ROLLBACK_KEYS, "receipt.rollback");

  for (const [label, digest] of [
    ["receipt.source.fileSha256", receipt.source.fileSha256],
    ["receipt.source.textSha256", receipt.source.textSha256],
    ["receipt.result.fileSha256", receipt.result.fileSha256],
    ["receipt.result.textSha256", receipt.result.textSha256],
    ["receipt.rollback.expectedCurrentTextSha256", receipt.rollback.expectedCurrentTextSha256],
  ]) {
    assertTextDigest(digest, label);
  }

  if (receipt.result?.file !== getSlotDefinition(receipt.operation.slot).file || receipt.source?.file !== receipt.result.file) {
    fail("Receipt file does not match the allowlisted slot path.");
  }

  if (receipt.rollback?.restoreValue !== normalizePublicText(receipt.rollback?.restoreValue)) {
    fail("Receipt rollback value is malformed.");
  }

  if (receipt.source.textSha256 !== textDigest(receipt.rollback.restoreValue)) {
    fail("Receipt rollback value does not match the recorded source text identity.");
  }

  if (receipt.result.textSha256 !== textDigest(receipt.operation.value)) {
    fail("Receipt result text identity does not match the recorded operation.");
  }

  if (receipt.rollback.expectedCurrentTextSha256 !== receipt.result.textSha256) {
    fail("Receipt rollback guard does not match the recorded result.");
  }

  if (
    receipt.rollback.type !== "inverse_set_public_text_through_new_pull_request" ||
    receipt.verification.status !== "passed" ||
    receipt.verification.verifiedAt !== receipt.materializedAt ||
    receipt.publicationAuthority.boundary !== "authenticated-github-pull-request-review-and-merge" ||
    receipt.publicationAuthority.status !== "pending-human-approval" ||
    receipt.publicationAuthority.actorReference !== "recorded by GitHub on review and merge"
  ) {
    fail("Receipt fixed audit fields are malformed.");
  }

  if (
    typeof receipt.materializedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(receipt.materializedAt) ||
    Number.isNaN(Date.parse(receipt.materializedAt))
  ) {
    fail("Receipt materializedAt is not a valid RFC 3339 UTC timestamp.");
  }

  return receipt;
};

export const createRollbackProposal = ({ root, receipt, base, proposalId, now = new Date() }) => {
  validateReceipt(receipt);

  if (typeof root !== "string") {
    fail("Rollback requires a repository root for immutable source verification.");
  }

  const immutableSource = readImmutableGitSource(root, {
    head: receipt.source.head,
    tree: receipt.source.tree,
    file: receipt.source.file,
    slot: receipt.operation.slot,
  });

  if (
    fileDigest(immutableSource.source) !== receipt.source.fileSha256 ||
    textDigest(immutableSource.value) !== receipt.source.textSha256 ||
    immutableSource.value !== receipt.rollback.restoreValue
  ) {
    fail("Receipt rollback value does not match the immutable Git source.");
  }

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

const readGitFile = (root, tree, file) => {
  try {
    return execFileSync("git", ["show", `${tree}:${file}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail(`Required Git file is unavailable: ${file}.`);
  }
};

const changedFilesBetween = (root, base, head) => {
  const output = execFileSync(
    "git",
    ["diff", "--name-status", "--no-renames", "-z", base, head],
    { cwd: root, encoding: "utf8" }
  );
  const tokens = output.split("\0");

  if (tokens.at(-1) === "") {
    tokens.pop();
  }

  if (tokens.length % 2 !== 0) {
    fail("Git returned a malformed candidate diff.");
  }

  const changes = [];
  for (let index = 0; index < tokens.length; index += 2) {
    changes.push({ status: tokens[index], file: tokens[index + 1] });
  }
  return changes;
};

const gitPathExists = (root, revision, file) => {
  try {
    execFileSync("git", ["cat-file", "-e", `${revision}:${file}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

export const validateCandidateDiff = (root, { base, head }) => {
  for (const [label, value] of [["base", base], ["head", head]]) {
    if (typeof value !== "string" || !/^[a-f0-9]{40}$/u.test(value)) {
      fail(`Candidate ${label} must be an exact 40-character Git identity.`);
    }
  }

  let actualHead;
  let baseTree;
  let headTree;

  try {
    actualHead = gitOutput(root, ["rev-parse", "HEAD"]);
    baseTree = gitOutput(root, ["rev-parse", `${base}^{tree}`]);
    headTree = gitOutput(root, ["rev-parse", `${head}^{tree}`]);
    execFileSync("git", ["merge-base", "--is-ancestor", base, head], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    fail("Candidate base/head are unavailable or the base is not an ancestor of the head.");
  }

  if (actualHead !== head) {
    fail(`Candidate check requires exact HEAD ${head}; current HEAD is ${actualHead}.`);
  }

  const changes = changedFilesBetween(root, base, head);
  const changedFiles = changes.map(({ file }) => file);
  const contractPath = "scripts/publication-contract.mjs";

  if (!gitPathExists(root, base, contractPath)) {
    const requiredBootstrapChanges = new Map([
      [".github/workflows/governed-publication-check.yml", "A"],
      ["BackPackKidzWebsite/index.html", "M"],
      ["BackPackKidzWebsite/pages/future-events.html", "M"],
      ["publication/README.md", "A"],
      ["publication/proposal.schema.json", "A"],
      ["scripts/governed-publication.mjs", "A"],
      [contractPath, "A"],
      ["tests/publication-contract.test.mjs", "A"],
    ]);

    for (const [file, status] of requiredBootstrapChanges) {
      if (!changes.some((change) => change.file === file && change.status === status)) {
        fail(`Governed-lane bootstrap is missing required ${status} change: ${file}.`);
      }
    }

    if (changedFiles.some((file) => file.startsWith("publication/audit/"))) {
      fail("Governed-lane bootstrap cannot include a publication receipt.");
    }

    return { status: "passed", mode: "governed-lane-bootstrap", base, head, headTree, changedFiles };
  }

  const slotFiles = new Set(Object.values(SLOT_DEFINITIONS).map(({ file }) => file));
  const governedChanges = changes.filter(
    ({ file }) => slotFiles.has(file) || file.startsWith("publication/audit/")
  );

  if (governedChanges.length === 0) {
    return { status: "passed", mode: "non-publication-change", base, head, headTree, changedFiles };
  }

  if (changes.length !== 2) {
    fail("A publication candidate must change exactly one allowlisted slot file and add exactly one receipt.");
  }

  const targetChange = changes.find(({ file }) => slotFiles.has(file));
  const receiptChange = changes.find(({ file }) => file.startsWith("publication/audit/"));

  if (targetChange?.status !== "M" || receiptChange?.status !== "A") {
    fail("A publication candidate requires one modified allowlisted slot and one newly added receipt.");
  }

  const receiptMatch = /^publication\/audit\/(pub-[a-z0-9][a-z0-9-]{5,63})\.json$/u.exec(receiptChange.file);
  if (!receiptMatch) {
    fail("Publication receipt path does not match its governed proposal identity.");
  }

  let receipt;
  try {
    receipt = JSON.parse(readGitFile(root, headTree, receiptChange.file));
  } catch (error) {
    fail(`Publication receipt is not valid JSON: ${error.message}`);
  }
  validateReceipt(receipt);

  if (receipt.proposalId !== receiptMatch[1]) {
    fail("Publication receipt filename does not match its proposalId.");
  }
  if (
    receipt.source.head !== base ||
    receipt.source.tree !== baseTree ||
    receipt.source.file !== targetChange.file ||
    receipt.result.file !== targetChange.file ||
    getSlotDefinition(receipt.operation.slot)?.file !== targetChange.file
  ) {
    fail("Publication receipt does not bind the exact PR base and allowlisted target.");
  }

  const baseSource = readGitFile(root, baseTree, targetChange.file);
  const headSource = readGitFile(root, headTree, targetChange.file);
  const expectedSource = applyProposalToSource(baseSource, receipt.proposal);

  if (headSource !== expectedSource) {
    fail("Publication candidate target differs from deterministic proposal materialization.");
  }
  if (
    receipt.source.fileSha256 !== fileDigest(baseSource) ||
    receipt.result.fileSha256 !== fileDigest(expectedSource)
  ) {
    fail("Publication receipt file identities do not match the exact Git source and result.");
  }
  verifyProposalInSource(headSource, receipt.proposal);

  return {
    status: "passed",
    mode: "governed-publication-candidate",
    base,
    head,
    headTree,
    proposalId: receipt.proposalId,
    proposalDigest: receipt.proposalDigest,
    changedFiles,
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
  "candidate-check",
]);

export const assertAllowedCommand = (command) => {
  if (!allowedCommands.includes(command)) {
    fail(`Unsupported command "${command}". This tool has no publish, deploy, merge, or arbitrary-file command.`);
  }

  return command;
};

export const loadJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export const publicUrlForSlot = (baseUrl, slot) => {
  const definition = getSlotDefinition(slot);

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

const LIVE_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_LIVE_REDIRECTS = 5;

export const fetchPublicSlotResponse = async (baseUrl, slot, fetchImpl = globalThis.fetch) => {
  if (typeof fetchImpl !== "function") {
    fail("Live verification requires a fetch implementation.");
  }

  let url = publicUrlForSlot(baseUrl, slot);

  for (let redirectCount = 0; redirectCount <= MAX_LIVE_REDIRECTS; redirectCount += 1) {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });

    if (!LIVE_REDIRECT_STATUSES.has(response.status)) {
      if (response.url && new URL(response.url, url).toString() !== url) {
        fail("Live verification response URL changed outside the approved redirect policy.");
      }

      return { response, url };
    }

    if (redirectCount === MAX_LIVE_REDIRECTS) {
      fail(`Live verification exceeded ${MAX_LIVE_REDIRECTS} approved redirects.`);
    }

    const location = response.headers?.get?.("location");

    if (!location) {
      fail("Live verification redirect is missing a Location header.");
    }

    const destination = new URL(location, url).toString();
    const approvedDestination = publicUrlForSlot(destination, slot);

    if (destination !== approvedDestination) {
      fail("Live verification redirect must target the exact governed slot URL on an approved Back Pack Kidz host.");
    }

    url = approvedDestination;
  }

  fail("Live verification redirect handling failed closed.");
};

export { normalizePublicText, sha256 };
