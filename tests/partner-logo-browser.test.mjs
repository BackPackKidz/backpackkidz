import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, extname, sep } from "node:path";
import test from "node:test";
import { browserQa } from "../scripts/partner-logo-browser.mjs";
import { PARTNERS, planLogoFiles, REGISTRY_PATH, TODO_PATH, sha } from "../scripts/partner-logo-contract.mjs";

const root = resolve(import.meta.dirname, "../BackPackKidzWebsite");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAFElEQVR4AQEJAPb/ABR4Mv8ooFD/DjcD1SSES2cAAAAASUVORK5CYII=", "base64");
const item = partner_id => ({ partner_id, proposal_sha256: "a".repeat(64), decision_sha256: "b".repeat(64), candidate_ref: "synthetic-candidate-" + partner_id, custody_sha256: "c".repeat(64), classification: "synthetic_public_safe", asset_sha256: sha(PNG), width: 2, height: 1, metadata: { alt: "Synthetic fixture pixels", layout: "" } });
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };

test("real browser renders two synthetic logos with accessibility, responsive, link and console checks", { timeout: 180000 }, async t => {
  const items = Object.keys(PARTNERS).sort().map(item);
  const files = planLogoFiles({ registry: readFileSync(resolve(root, "script.js"), "utf8"), todo: readFileSync(resolve(root, "pages/our-partners.html"), "utf8"), items, assets: new Map(items.map(i => [i.partner_id, PNG])) });
  const overlays = new Map([...files].map(([path, bytes]) => [path.replace("BackPackKidzWebsite", ""), bytes]));
  let useCandidate = false;
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const file = resolve(root, "." + path);
    if (request.method !== "GET" || !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const raw = (useCandidate ? overlays.get(path) : null) ?? (existsSync(file) && statSync(file).isFile() ? readFileSync(file) : null);
    if (!raw) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" }); response.end(raw);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseline = await browserQa(`http://127.0.0.1:${server.address().port}`, [], { localFixture: true });
  useCandidate = true;
  const report = await browserQa(`http://127.0.0.1:${server.address().port}`, items, { localFixture: true });
  const reports = resolve(tmpdir(), "bpk-partner-logo-source-qa");
  mkdirSync(reports, { recursive: true });
  writeFileSync(resolve(reports, "browser-baseline-and-candidate.json"), JSON.stringify({ baseline, candidate: report }, null, 2));
  // This regression test does not convert the deployment verifier to success:
  // full-page findings still make report.passed false and block publication.
  assert.deepEqual(report.cases.map(value => value.accessibility), baseline.cases.map(value => value.accessibility));
  assert.deepEqual(report.console_errors, []);
  assert.deepEqual(report.failed_resources, []);
  assert.equal(report.passed, baseline.passed);
  assert.deepEqual(report.cases.map(value => value.width), [360, 768, 1440]);
});

test("browser verifier rejects arbitrary URLs before launching", async () => {
  for (const url of ["https://attacker.invalid", "https://backpackkidz.netlify.app", "http://example.invalid", "https://a--backpackkidz.netlify.app", "https://" + "a".repeat(24) + "--backpackkidz.netlify.app@attacker.invalid"]) await assert.rejects(browserQa(url, []), /browser_origin_invalid/u);
});
