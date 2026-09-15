#!/usr/bin/env node
// Private executor IPC. Repository/paths/ref/commands never come from input.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { canonicalJson, getGitIdentity, resolveSafeRepositoryPath } from "./publication-contract.mjs";
import { contentManifest, immutableLogoSource, logoRollbackPlan, PARTNERS, planLogoFiles, sha, validateGrant, validateLogoCandidate, validateReceipt } from "./partner-logo-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const require = (condition, code) => { if (!condition) throw new Error(code); };
const exact = (value, keys) => require(value && Object.keys(value).sort().join() === keys.sort().join(), "ipc_fields_invalid");
const now = () => Math.floor(Date.now() / 1000);

async function body() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    require(length <= 172000000, "ipc_size_invalid");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const value = JSON.parse(raw);
  require(canonicalJson(value) === raw, "ipc_noncanonical");
  return value;
}

function assets(input, items) {
  exact(input, items.map(i => i.partner_id));
  return new Map(items.map(item => {
    const text = input[item.partner_id];
    require(typeof text === "string" && text.length <= 85400000 && /^[A-Za-z0-9+/]+={0,2}$/u.test(text), "asset_encoding_invalid");
    const bytes = Buffer.from(text, "base64");
    require(bytes.toString("base64") === text, "asset_encoding_invalid");
    return [item.partner_id, bytes];
  }));
}

function context(base, bundle, clean) {
  require(canonicalJson(getGitIdentity(root)) === canonicalJson(base), "logo_base_stale");
  require(git(["branch", "--show-current"]) === `pilot/partner-logos-${bundle}`, "logo_branch_invalid");
  require(/^(?:https:\/\/github\.com\/|git@github\.com:)BackPackKidz\/backpackkidz(?:\.git)?$/u.test(git(["remote", "get-url", "origin"])), "logo_repository_invalid");
  if (clean) require(!git(["status", "--porcelain"]), "logo_worktree_dirty");
}

async function main() {
  require(process.argv.length === 3, "ipc_command_invalid");
  const command = process.argv[2];
  const value = await body();
  if (command === "rollback-preview") {
    exact(value, ["bundle_sha256"]);
    require(!git(["status", "--porcelain"]), "logo_worktree_dirty");
    const result = logoRollbackPlan(root, git(["rev-parse", "HEAD"]), value.bundle_sha256);
    return { receipt: result.receipt, receipt_path: result.receiptPath, requires_separate_human_merge_authorization: true, materialization_performed: false };
  }
  if (command === "candidate-preview-check") {
    exact(value, ["base", "head"]);
    const result = validateLogoCandidate(root, { ...value, preview: true });
    require(result, "logo_candidate_missing");
    return result;
  }
  if (command === "plan") {
    exact(value, ["base", "items", "assets"]);
    require(canonicalJson(getGitIdentity(root)) === canonicalJson(value.base) && !git(["status", "--porcelain"]), "logo_plan_base_stale_or_dirty");
    const source = immutableLogoSource(root, value.base);
    const files = planLogoFiles({ ...source, items: value.items, assets: assets(value.assets, value.items) });
    const manifest = contentManifest(files);
    return { base: value.base, manifest, diff: [...files].filter(([path]) => !path.endsWith(".png")).map(([path, bytes]) => ({ path, before: readFileSync(resolveSafeRepositoryPath(root, path, { requireFile: true }), "utf8").replace(/\r\n?/gu, "\n"), after: bytes.toString("utf8") })), assets: value.items.map(item => ({ partner_id: item.partner_id, path: PARTNERS[item.partner_id].asset, sha256: item.asset_sha256, width: item.width, height: item.height })) };
  }
  if (command === "materialize-files") {
    exact(value, ["grant", "assets"]);
    const source = immutableLogoSource(root, value.grant?.payload?.base ?? {});
    const grant = validateGrant(value.grant, source.keys, now());
    context(grant.base, grant.bundle_sha256, false);
    const files = planLogoFiles({ ...source, items: grant.items, assets: assets(value.assets, grant.items) });
    require(canonicalJson(contentManifest(files)) === canonicalJson(grant.manifest), "logo_manifest_mismatch");
    const changed = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).split(/\r?\n/u).filter(Boolean).map(line => line.slice(3));
    const receiptPath = `publication/audit/partner-logo-${grant.bundle_sha256}.json`;
    require(changed.every(path => files.has(path) || path === receiptPath), "logo_worktree_unintended_changes");
    for (const path of changed.filter(path => files.has(path))) require(readFileSync(resolveSafeRepositoryPath(root, path, { requireFile: true })).equals(files.get(path)), "logo_partial_materialization_conflict");
    if (changed.includes(receiptPath)) {
      const raw = readFileSync(resolveSafeRepositoryPath(root, receiptPath, { requireFile: true }), "utf8");
      const previous = JSON.parse(raw);
      require(raw === canonicalJson(previous) + "\n" && canonicalJson(previous.grant) === canonicalJson(value.grant), "logo_receipt_reconciliation_conflict");
      validateReceipt(previous, source.keys);
    }
    for (const path of files.keys()) resolveSafeRepositoryPath(root, path, { allowMissing: true, requireFile: true });
    // No writes precede complete validation of every source, output and path.
    require(now() < grant.expires_at, "logo_grant_expired");
    for (const [path, bytes] of files) {
      const target = resolveSafeRepositoryPath(root, path, { allowMissing: true, requireFile: true });
      mkdirSync(dirname(target), { recursive: true });
      resolveSafeRepositoryPath(root, path, { allowMissing: true, requireFile: true });
      writeFileSync(target, bytes, { flag: existsSync(target) ? "w" : "wx" });
    }
    return { manifest: contentManifest(files), materialized_at: now() };
  }
  if (command === "attach-receipt") {
    exact(value, ["receipt"]);
    const receipt = value.receipt;
    const source = immutableLogoSource(root, receipt?.grant?.payload?.base ?? {});
    const grant = validateReceipt(receipt, source.keys);
    context(grant.base, grant.bundle_sha256, false);
    require(now() < grant.expires_at, "logo_grant_expired");
    const input = new Map(grant.items.map(item => [item.partner_id, readFileSync(resolveSafeRepositoryPath(root, PARTNERS[item.partner_id].asset, { requireFile: true }))]));
    const files = planLogoFiles({ ...source, items: grant.items, assets: input });
    require(canonicalJson(contentManifest(files)) === canonicalJson(grant.manifest), "logo_manifest_mismatch");
    const paths = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).split(/\r?\n/u).filter(Boolean).map(line => line.slice(3));
    const relative = `publication/audit/partner-logo-${grant.bundle_sha256}.json`;
    require(paths.filter(path => path !== relative).length === files.size && paths.every(path => files.has(path) || path === relative), "logo_worktree_unintended_changes");
    for (const [path, bytes] of files) require(readFileSync(resolveSafeRepositoryPath(root, path, { requireFile: true })).equals(bytes), "logo_materialized_bytes_changed");
    const target = resolveSafeRepositoryPath(root, relative, { allowMissing: true });
    mkdirSync(dirname(target), { recursive: true });
    resolveSafeRepositoryPath(root, relative, { allowMissing: true });
    if (existsSync(target)) require(readFileSync(target, "utf8") === canonicalJson(receipt) + "\n", "logo_receipt_reconciliation_conflict");
    else writeFileSync(target, canonicalJson(receipt) + "\n", { flag: "wx" });
    return { receipt_path: relative, receipt_sha256: sha(Buffer.from(canonicalJson(receipt) + "\n")) };
  }
  throw new Error("ipc_command_forbidden");
}

main().then(value => process.stdout.write(canonicalJson(value))).catch(() => { process.stderr.write("partner_logo_operation_failed\n"); process.exitCode = 1; });
