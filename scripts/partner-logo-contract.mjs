// ADR 0036: finite operation, source-range edits, no JavaScript evaluation.
import { parse } from "acorn";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { inflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { canonicalJson, resolveSafeRepositoryPath } from "./publication-shared.mjs";

export const REGISTRY_PATH = "BackPackKidzWebsite/script.js";
export const TODO_PATH = "BackPackKidzWebsite/pages/our-partners.html";
export const KEY_PATH = "publication/partner-logo-keys.json";
export const PARTNERS = Object.freeze({
  nicolas: Object.freeze({ name: "Nicola's Italian Kitchen", href: "https://www.nicolasitaliankitchen.net/", asset: "BackPackKidzWebsite/assets/partner-nicolas-canonical.png" }),
  "studio-seven": Object.freeze({ name: "Studio Seven PG", href: "https://studiosevenpg.com/", asset: "BackPackKidzWebsite/assets/partner-studio-seven-canonical.png" }),
});
const PURPOSE = "partner_logo_execution_grant_v1";
const AUDIENCE = "BackPackKidz/backpackkidz/set_partner_logo";
const fail = (code) => { throw new Error(code); };
const require = (condition, code) => { if (!condition) fail(code); };
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exact = (object, fields, label) => require(object && Object.getPrototypeOf(object) === Object.prototype && Object.keys(object).sort().join("|") === [...fields].sort().join("|"), `${label}_fields_invalid`);
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const gitId = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const token = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/u.test(value);
const normalize = (source) => source.replace(/\r\n?/gu, "\n");
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let n = 0; n < 8; n++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const shape = (width, height) => require(Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1 && width <= 4096 && height <= 4096 && width * height <= 16000000, "logo_dimensions_invalid");

export function validateCanonicalPng(bytes, width, height) {
  require(Buffer.isBuffer(bytes) && bytes.length >= 57 && bytes.length <= 64020000 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")), "logo_png_invalid");
  shape(width, height);
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    require(chunks.length < 3 && offset + 12 <= bytes.length, "logo_png_chunks_invalid");
    const size = bytes.readUInt32BE(offset);
    require(size <= bytes.length - offset - 12, "logo_png_size_invalid");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    require(crc32(bytes.subarray(offset + 4, offset + 8 + size)) === bytes.readUInt32BE(offset + 8 + size), "logo_png_crc_invalid");
    chunks.push({ type, data });
    offset += size + 12;
  }
  require(chunks.map(c => c.type).join() === "IHDR,IDAT,IEND" && chunks[0].data.length === 13 && chunks[2].data.length === 0, "logo_png_metadata_or_animation");
  const header = chunks[0].data;
  require(header.readUInt32BE(0) === width && header.readUInt32BE(4) === height && header.subarray(8).equals(Buffer.from([8, 6, 0, 0, 0])), "logo_png_settings_invalid");
  const compressed = chunks[1].data;
  const expected = (width * 4 + 1) * height;
  let scan;
  try { scan = inflateSync(compressed, { maxOutputLength: expected + 1 }); } catch { fail("logo_png_deflate_invalid"); }
  require(scan.length === expected && compressed[0] === 0x78 && compressed[1] === 1, "logo_png_deflate_invalid");
  // Exact fixed stored-block layout excludes additional streams and trailing data.
  let input = 2;
  let output = 0;
  while (output < expected) {
    const length = Math.min(65535, expected - output);
    require(input + length + 5 <= compressed.length && compressed[input] === Number(output + length === expected) && compressed.readUInt16LE(input + 1) === length && compressed.readUInt16LE(input + 3) === (length ^ 65535), "logo_png_noncanonical");
    require(compressed.subarray(input + 5, input + 5 + length).equals(scan.subarray(output, output + length)), "logo_png_noncanonical");
    input += length + 5;
    output += length;
  }
  require(input + 4 === compressed.length, "logo_png_trailing_payload");
  for (let y = 0; y < height; y++) require(scan[y * (width * 4 + 1)] === 0, "logo_png_filter_invalid");
  return { width, height, sha256: sha(bytes), byteCount: bytes.length };
}

function literalObject(node) {
  require(node?.type === "ObjectExpression", "partner_record_not_literal");
  const result = {};
  for (const prop of node.properties) {
    require(prop.type === "Property" && prop.kind === "init" && !prop.method && !prop.computed && !prop.shorthand, "partner_record_unsafe_property");
    const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
    require(typeof key === "string" && !["__proto__", "prototype", "constructor"].includes(key) && !Object.hasOwn(result, key) && prop.value.type === "Literal" && ["string", "number", "boolean"].includes(typeof prop.value.value) && !prop.value.regex && !prop.value.bigint, "partner_record_duplicate_or_nonliteral");
    result[key] = prop.value.value;
  }
  return result;
}

function parseRegistry(source) {
  require(typeof source === "string" && Buffer.byteLength(source) <= 1000000, "registry_size_invalid");
  let ast;
  try { ast = parse(source, { ecmaVersion: 2022, sourceType: "script" }); } catch { fail("registry_parse_invalid"); }
  const declarations = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.id.name === "communityPartners") declarations.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(ast);
  require(declarations.length === 1, "registry_declaration_ambiguous");
  const declaration = declarations[0];
  require(ast.body.some(node => node.type === "VariableDeclaration" && node.kind === "const" && node.declarations.length === 1 && node.declarations[0] === declaration) && declaration.init?.type === "ArrayExpression", "registry_declaration_invalid");
  const entries = declaration.init.elements.map(node => ({ node, value: literalObject(node) }));
  for (const partner of Object.values(PARTNERS)) require(entries.filter(e => e.value.name === partner.name).length === 1 && entries.filter(e => e.value.name === partner.name && e.value.href === partner.href).length === 1, "partner_identity_ambiguous");
  return { ast, entries };
}

function strippedAst(node) {
  if (Array.isArray(node)) return node.map(strippedAst);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(Object.entries(node).filter(([key]) => !["start", "end", "raw"].includes(key)).map(([key, value]) => [key, strippedAst(value)]));
}

export function validateItem(item) {
  exact(item, ["partner_id", "proposal_sha256", "decision_sha256", "candidate_ref", "custody_sha256", "classification", "asset_sha256", "width", "height", "metadata"], "logo_item");
  require(Object.hasOwn(PARTNERS, item.partner_id) && ["synthetic_public_safe", "authorized_public_sponsor"].includes(item.classification) && token(item.candidate_ref), "logo_item_identity_invalid");
  for (const key of ["proposal_sha256", "decision_sha256", "custody_sha256", "asset_sha256"]) require(hash(item[key]), "logo_item_digest_invalid");
  shape(item.width, item.height);
  exact(item.metadata, ["alt", "layout"], "logo_metadata");
  const { alt, layout } = item.metadata;
  require(typeof alt === "string" && alt.length >= 1 && alt.length <= 120 && alt === alt.trim() && !/[<>\x00-\x1f\x7f@]|https?:\/\/|(?:token|password|secret)\s*[:=]|[A-Za-z0-9_+/=-]{48,}/iu.test(alt), "logo_alt_invalid");
  require(["", "sponsor-logo-wide", "sponsor-logo-tall"].includes(layout), "logo_layout_invalid");
  return item;
}

export function editRegistry(original, items) {
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const source = normalize(original);
  const before = parseRegistry(source);
  const replacements = [];
  const expected = before.entries.map(entry => ({ ...entry.value }));
  for (const item of items) {
    validateItem(item);
    const partner = PARTNERS[item.partner_id];
    const index = before.entries.findIndex(entry => entry.value.name === partner.name);
    const { node } = before.entries[index];
    const fields = { image: partner.asset.replace("BackPackKidzWebsite", ""), alt: item.metadata.alt, width: item.width, height: item.height };
    if (item.metadata.layout) fields.className = item.metadata.layout;
    else if (Object.hasOwn(expected[index], "className")) fields.className = "";
    const missing = [];
    for (const [key, value] of Object.entries(fields)) {
      const property = node.properties.find(prop => (prop.key.name ?? prop.key.value) === key);
      if (property) replacements.push([property.value.start, property.value.end, JSON.stringify(value)]);
      else missing.push(`    ${key}: ${JSON.stringify(value)},`);
      expected[index][key] = value;
    }
    if (missing.length) {
      const last = node.properties.at(-1);
      const tail = source.slice(last.end, node.end - 1);
      require(/^,?\s*$/u.test(tail), "partner_record_tail_ambiguous");
      replacements.push([last.end, node.end - 1, `${tail.trimStart().startsWith(",") ? "," : ","}\n${missing.join("\n")}\n  `]);
    }
  }
  let result = source;
  for (const [start, end, value] of replacements.sort((a, b) => b[0] - a[0])) result = result.slice(0, start) + value + result.slice(end);
  const after = parseRegistry(result);
  require(canonicalJson(after.entries.map(e => e.value)) === canonicalJson(expected), "partner_record_unexpected_change");
  // Compare the complete AST after masking only the exact permitted properties.
  for (const registry of [before, after]) {
    for (const item of items) {
      const entry = registry.entries.find(e => e.value.name === PARTNERS[item.partner_id].name);
      entry.node.properties = entry.node.properties.filter(prop => !["image", "alt", "width", "height", "className"].includes(prop.key.name ?? prop.key.value));
    }
  }
  require(canonicalJson(strippedAst(before.ast)) === canonicalJson(strippedAst(after.ast)), "registry_ast_unexpected_change");
  return newline === "\r\n" ? result.replace(/\n/gu, "\r\n") : result;
}

const ORIGINAL_TODO = "<!-- TODO (owner): Provide approved logo files for Nicola's Italian Kitchen and Studio Seven PG. Until then, the shared partner renderer shows their names as text fallbacks instead of broken images. -->";
const oneTodo = (name) => `<!-- TODO (owner): Provide an approved logo file for ${name}. Until then, the shared partner renderer shows its name as a text fallback instead of a broken image. -->`;
export function editTodo(source, registryAfter) {
  const entries = parseRegistry(normalize(registryAfter)).entries;
  const missing = Object.values(PARTNERS).filter(p => !entries.find(e => e.value.name === p.name).value.image);
  const known = [ORIGINAL_TODO, ...Object.values(PARTNERS).map(p => oneTodo(p.name))];
  const matches = known.flatMap(text => Array.from(source.matchAll(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu")), m => ({ text, index: m.index })));
  require(matches.length <= 1, "partner_todo_ambiguous");
  if (!matches.length) { require(missing.length === 0, "partner_todo_missing"); return source; }
  const replacement = missing.length === 0 ? "" : missing.length === 1 ? oneTodo(missing[0].name) : ORIGINAL_TODO;
  return source.replace(matches[0].text, replacement);
}

export function planLogoFiles({ registry, todo, items, assets }) {
  require(Array.isArray(items) && items.length >= 1 && items.length <= 2 && new Set(items.map(i => i.partner_id)).size === items.length, "logo_items_invalid");
  require(items.map(i => i.partner_id).join() === items.map(i => i.partner_id).sort().join(), "logo_item_order_invalid");
  const files = new Map();
  const changed = editRegistry(registry, items);
  if (normalize(changed) !== normalize(registry)) files.set(REGISTRY_PATH, Buffer.from(normalize(changed)));
  const changedTodo = editTodo(todo, changed);
  if (normalize(changedTodo) !== normalize(todo)) files.set(TODO_PATH, Buffer.from(normalize(changedTodo)));
  for (const item of items) {
    const bytes = assets.get(item.partner_id);
    validateCanonicalPng(bytes, item.width, item.height);
    require(sha(bytes) === item.asset_sha256, "logo_asset_digest_invalid");
    files.set(PARTNERS[item.partner_id].asset, bytes);
  }
  return files;
}

export const contentManifest = (files) => [...files].sort(([a], [b]) => a.localeCompare(b, "en")).map(([path, bytes]) => ({ path, mode: "100644", sha256: sha(bytes) }));

function verifyEnvelope(envelope, keys, at, historical = false) {
  exact(envelope, ["schema_version", "algorithm", "key_id", "payload", "signature"], "logo_assertion");
  require(envelope.schema_version === 1 && envelope.algorithm === "Ed25519", "logo_assertion_algorithm_invalid");
  const payload = envelope.payload;
  require(payload?.purpose === PURPOSE && payload?.audience === AUDIENCE && payload.organization_id === "back-pack-kidz" && payload.workspace_id === "production", "logo_assertion_purpose_invalid");
  const matches = keys.filter(key => key.key_id === envelope.key_id && key.purpose === PURPOSE);
  require(matches.length === 1, "logo_signer_untrusted");
  const key = matches[0];
  require(Number.isSafeInteger(payload.issued_at) && Number.isSafeInteger(payload.expires_at) && key.not_before <= payload.issued_at && payload.issued_at < payload.expires_at && payload.expires_at <= key.not_after && payload.expires_at - payload.issued_at <= 300, "logo_grant_window_invalid");
  require(payload.issued_at <= at && (historical || at < payload.expires_at), "logo_grant_expired");
  const unsigned = { ...envelope }; delete unsigned.signature;
  require(typeof envelope.signature === "string" && /^[A-Za-z0-9_-]{86}$/u.test(envelope.signature), "logo_signature_invalid");
  const signature = Buffer.from(envelope.signature, "base64url");
  require(signature.toString("base64url") === envelope.signature && signature.length === 64, "logo_signature_invalid");
  try {
    const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key.public_key, "base64url")]), format: "der", type: "spki" });
    require(verifySignature(null, Buffer.from(canonicalJson(unsigned)), publicKey, signature), "logo_signature_invalid");
  } catch { fail("logo_signature_invalid"); }
  return payload;
}

export function validateGrant(grant, keys, at, historical = false) {
  const value = verifyEnvelope(grant, keys, at, historical);
  exact(value, ["purpose", "audience", "organization_id", "workspace_id", "phase", "execution_id", "run_id", "repository", "base", "items", "bundle_sha256", "bundle_decision_sha256", "manifest", "issued_at", "expires_at"], "logo_grant");
  require(value.phase === "reserved" && token(value.execution_id) && token(value.run_id) && value.repository === "BackPackKidz/backpackkidz", "logo_grant_identity_invalid");
  exact(value.base, ["head", "tree"], "logo_base");
  require(gitId(value.base.head) && gitId(value.base.tree) && hash(value.bundle_sha256) && hash(value.bundle_decision_sha256), "logo_grant_binding_invalid");
  require(Array.isArray(value.items) && value.items.length >= 1 && value.items.length <= 2 && new Set(value.items.map(i => i.partner_id)).size === value.items.length, "logo_items_invalid");
  value.items.forEach(validateItem);
  require(value.items.map(i => i.partner_id).join() === value.items.map(i => i.partner_id).sort().join(), "logo_item_order_invalid");
  require(Array.isArray(value.manifest) && value.manifest.length >= 2 && value.manifest.length <= 4, "logo_manifest_invalid");
  for (const item of value.manifest) { exact(item, ["path", "mode", "sha256"], "logo_manifest_entry"); require(item.mode === "100644" && hash(item.sha256) && [REGISTRY_PATH, TODO_PATH, ...value.items.map(i => PARTNERS[i.partner_id].asset)].includes(item.path), "logo_manifest_path_invalid"); }
  require(new Set(value.manifest.map(i => i.path)).size === value.manifest.length, "logo_manifest_duplicate");
  return value;
}

export function validateReceipt(receipt, keys) {
  exact(receipt, ["schema", "grant", "materialization"], "logo_receipt");
  require(receipt.schema === "partner_logo_receipt_v1", "logo_receipt_schema_invalid");
  const at = receipt.materialization?.payload?.materialized_at;
  require(Number.isSafeInteger(at), "logo_materialization_time_invalid");
  const grant = validateGrant(receipt.grant, keys, at);
  const record = verifyEnvelope(receipt.materialization, keys, at);
  exact(record, ["purpose", "audience", "organization_id", "workspace_id", "phase", "execution_id", "grant_sha256", "manifest_sha256", "materialized_at", "issued_at", "expires_at"], "logo_materialization");
  require(record.phase === "materialized" && record.execution_id === grant.execution_id && record.issued_at === at && record.expires_at === grant.expires_at && record.grant_sha256 === sha(Buffer.from(canonicalJson(receipt.grant))) && record.manifest_sha256 === sha(Buffer.from(canonicalJson(grant.manifest))), "logo_materialization_binding_invalid");
  return grant;
}

const git = (root, args) => execFileSync("git", args, { cwd: root, maxBuffer: 70000000, stdio: ["ignore", "pipe", "pipe"] });
const gitText = (root, args) => git(root, args).toString("utf8").trim();
export function immutableLogoSource(root, base) {
  require(gitId(base.head) && gitId(base.tree) && gitText(root, ["rev-parse", `${base.head}^{tree}`]) === base.tree, "logo_base_identity_invalid");
  const files = {};
  for (const path of [REGISTRY_PATH, TODO_PATH, KEY_PATH]) {
    const tree = gitText(root, ["ls-tree", base.head, "--", path]);
    require(tree.startsWith("100644 blob ") && tree.endsWith(`\t${path}`), "logo_base_mode_invalid");
    files[path] = git(root, ["show", `${base.head}:${path}`]).toString("utf8");
  }
  let registry;
  try { registry = JSON.parse(files[KEY_PATH]); } catch { fail("logo_key_registry_invalid"); }
  exact(registry, ["schema", "keys"], "logo_keys");
  require(registry.schema === "partner_logo_execution_keys_v1" && Array.isArray(registry.keys), "logo_key_registry_invalid");
  require(registry.keys.length <= 4 && new Set(registry.keys.map(key => key.key_id)).size === registry.keys.length && new Set(registry.keys.map(key => key.public_key)).size === registry.keys.length, "logo_key_registry_ambiguous");
  for (const key of registry.keys) {
    exact(key, ["key_id", "purpose", "public_key", "not_before", "not_after"], "logo_public_key");
    require(token(key.key_id) && key.purpose === PURPOSE && Number.isSafeInteger(key.not_before) && Number.isSafeInteger(key.not_after) && key.not_before < key.not_after && typeof key.public_key === "string" && /^[A-Za-z0-9_-]{43}$/u.test(key.public_key) && Buffer.from(key.public_key, "base64url").toString("base64url") === key.public_key, "logo_public_key_invalid");
  }
  return { registry: files[REGISTRY_PATH], todo: files[TODO_PATH], keys: registry.keys };
}

function candidateChanges(root, base, head) {
  const changed = git(root, ["diff", "--name-status", "--no-renames", "-z", base, head]).toString("utf8").split("\0").filter(Boolean);
  return Array.from({ length: changed.length / 2 }, (_, i) => ({ status: changed[i * 2], path: changed[i * 2 + 1] }));
}

function verifyLogoTree(root, { base, head, preview = false, working = true }) {
  require(gitId(base) && gitId(head), "logo_candidate_identity_invalid");
  try { git(root, ["merge-base", "--is-ancestor", base, head]); } catch { fail("logo_candidate_base_invalid"); }
  const baseTree = gitText(root, ["rev-parse", `${base}^{tree}`]);
  const changes = candidateChanges(root, base, head);
  const receipts = changes.filter(c => c.path.startsWith("publication/audit/partner-logo-"));
  const touched = changes.some(c => c.path === REGISTRY_PATH || c.path === TODO_PATH || Object.values(PARTNERS).some(p => p.asset === c.path));
  if (!receipts.length && !touched) return null;
  require(receipts.length === 1 && receipts[0].status === "A" && /^publication\/audit\/partner-logo-[a-f0-9]{64}\.json$/u.test(receipts[0].path), "logo_receipt_missing_or_ambiguous");
  const source = immutableLogoSource(root, { head: base, tree: baseTree });
  const rawReceipt = git(root, ["show", `${head}:${receipts[0].path}`]).toString("utf8");
  let receipt;
  try { receipt = JSON.parse(rawReceipt); } catch { fail("logo_receipt_json_invalid"); }
  require(rawReceipt === canonicalJson(receipt) + "\n", "logo_receipt_noncanonical");
  const grant = validateReceipt(receipt, source.keys);
  require(receipts[0].path === `publication/audit/partner-logo-${grant.bundle_sha256}.json` && grant.base.head === base && grant.base.tree === baseTree, "logo_receipt_base_invalid");
  const assets = new Map(grant.items.map(item => [item.partner_id, git(root, ["show", `${head}:${PARTNERS[item.partner_id].asset}`])]));
  const files = planLogoFiles({ ...source, items: grant.items, assets });
  require(canonicalJson(contentManifest(files)) === canonicalJson(grant.manifest), "logo_manifest_mismatch");
  files.set(receipts[0].path, Buffer.from(rawReceipt));
  require(changes.length === files.size && changes.every(c => files.has(c.path) && ["M", "A"].includes(c.status)), "logo_unintended_diff");
  for (const [path, bytes] of files) {
    require(gitText(root, ["ls-tree", head, "--", path]).startsWith("100644 blob "), "logo_candidate_mode_invalid");
    require(git(root, ["show", `${head}:${path}`]).equals(bytes), "logo_candidate_bytes_mismatch");
    if (working) resolveSafeRepositoryPath(root, path, { requireFile: true });
  }
  if (!preview && grant.items.some(item => item.classification === "synthetic_public_safe")) fail("synthetic_candidate_not_publishable");
  return { status: "passed", mode: preview ? "partner-logo-preview" : "partner-logo-publication-candidate", head, headTree: gitText(root, ["rev-parse", `${head}^{tree}`]), bundleSha256: grant.bundle_sha256, changedFiles: [...files.keys()] };
}

export function logoRollbackPlan(root, base, bundle) {
  require(gitId(base) && hash(bundle), "logo_rollback_identity_invalid");
  const originalPath = `publication/audit/partner-logo-${bundle}.json`;
  const originalRaw = git(root, ["show", `${base}:${originalPath}`]).toString("utf8");
  const original = JSON.parse(originalRaw);
  const grant = original.grant?.payload;
  require(grant?.bundle_sha256 === bundle && originalRaw === canonicalJson(original) + "\n", "logo_rollback_receipt_invalid");
  // Derive the historical source solely from this fixed receipt's ancestry.
  // The caller cannot provide a restore ref or arbitrary file path.
  const additions = gitText(root, ["log", "--first-parent", "--diff-filter=A", "--format=%H", "-n", "2", base, "--", originalPath]).split(/\r?\n/u).filter(Boolean);
  require(additions.length === 1 && gitId(additions[0]), "logo_rollback_source_ambiguous");
  const originalHead = additions[0];
  verifyLogoTree(root, { base: grant.base.head, head: originalHead, preview: false, working: false });
  require(git(root, ["show", `${originalHead}:${originalPath}`]).toString("utf8") === originalRaw, "logo_rollback_receipt_changed");
  const restore = new Map();
  for (const path of [...grant.manifest.map(item => item.path), originalPath]) {
    require(git(root, ["show", `${base}:${path}`]).equals(git(root, ["show", `${originalHead}:${path}`])), "logo_rollback_target_changed");
    const mode = gitText(root, ["ls-tree", grant.base.head, "--", path]);
    if (mode) {
      require(mode.startsWith("100644 blob "), "logo_rollback_source_mode_invalid");
      restore.set(path, git(root, ["show", `${grant.base.head}:${path}`]));
    } else restore.set(path, null);
  }
  const receipt = { schema: "partner_logo_rollback_receipt_v1", base: { head: base, tree: gitText(root, ["rev-parse", `${base}^{tree}`]) }, original_commit: originalHead, original_receipt_sha256: sha(Buffer.from(originalRaw)), original_bundle_sha256: bundle, restore_manifest: [...restore].map(([path, bytes]) => ({ path, mode: bytes === null ? null : "100644", sha256: bytes === null ? null : sha(bytes) })).sort((a, b) => a.path.localeCompare(b.path, "en")) };
  const receiptPath = `publication/audit/partner-logo-rollback-${bundle}.json`;
  return { receipt, receiptPath, restore };
}

function verifyLogoRollback(root, base, head, rollback, changes) {
  require(rollback.length === 1 && rollback[0].status === "A" && /^publication\/audit\/partner-logo-rollback-[a-f0-9]{64}\.json$/u.test(rollback[0].path), "logo_rollback_receipt_invalid");
  const bundle = rollback[0].path.slice("publication/audit/partner-logo-rollback-".length, -5);
  const plan = logoRollbackPlan(root, base, bundle);
  const encoded = Buffer.from(canonicalJson(plan.receipt) + "\n");
  require(git(root, ["show", `${head}:${plan.receiptPath}`]).equals(encoded), "logo_rollback_receipt_tampered");
  const expected = new Map([...plan.restore, [plan.receiptPath, encoded]]);
  require(changes.length === expected.size && changes.every(change => expected.has(change.path)), "logo_rollback_extra_diff");
  for (const change of changes) {
    const raw = expected.get(change.path);
    if (raw === null) {
      require(change.status === "D" && !gitText(root, ["ls-tree", head, "--", change.path]), "logo_rollback_deletion_invalid");
      resolveSafeRepositoryPath(root, change.path, { allowMissing: true, requireFile: true });
    } else {
      require(change.status === (change.path === plan.receiptPath ? "A" : "M") && gitText(root, ["ls-tree", head, "--", change.path]).startsWith("100644 blob ") && git(root, ["show", `${head}:${change.path}`]).equals(raw), "logo_rollback_bytes_invalid");
      resolveSafeRepositoryPath(root, change.path, { requireFile: true });
    }
  }
  return { status: "passed", mode: "partner-logo-human-rollback-candidate", head, headTree: gitText(root, ["rev-parse", `${head}^{tree}`]), bundleSha256: bundle, changedFiles: [...expected.keys()], requiresSeparateHumanMergeAuthorization: true };
}

export function validateLogoCandidate(root, { base, head, preview = false }) {
  require(gitId(base) && gitId(head) && gitText(root, ["rev-parse", "HEAD"]) === head, "logo_candidate_identity_invalid");
  try { git(root, ["merge-base", "--is-ancestor", base, head]); } catch { fail("logo_candidate_base_invalid"); }
  const changes = candidateChanges(root, base, head);
  const rollback = changes.filter(change => change.path.startsWith("publication/audit/partner-logo-rollback-"));
  if (rollback.length) return verifyLogoRollback(root, base, head, rollback, changes);
  return verifyLogoTree(root, { base, head, preview });
}
