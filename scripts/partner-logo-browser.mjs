// Read-only browser QA. CLI addresses only an immutable Back Pack Kidz deploy.
import { chromium } from "playwright";
import axe from "axe-core";
import { pathToFileURL } from "node:url";
import { canonicalJson } from "./publication-shared.mjs";
import { PARTNERS, sha, validateItem } from "./partner-logo-contract.mjs";

const require = (ok, code) => { if (!ok) throw new Error(code); };
export async function browserQa(origin, items, { localFixture = false } = {}) {
  const url = new URL(origin);
  require(url.origin === origin && (localFixture ? /^http:\/\/127\.0\.0\.1:[0-9]+$/u.test(origin) : /^https:\/\/[a-f0-9]{24}--backpackkidz\.netlify\.app$/u.test(origin)), "browser_origin_invalid");
  require(Array.isArray(items) && items.length <= 2 && new Set(items.map(i => i.partner_id)).size === items.length, "browser_items_invalid");
  items.forEach(validateItem);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false, reducedMotion: "reduce" });
    const errors = [];
    const responses = [];
    // No forms, auth, analytics, mutation requests, or arbitrary navigation.
    await context.route("**/*", route => {
      const request = route.request();
      const target = new URL(request.url());
      if (request.method() !== "GET" || !["http:", "https:"].includes(target.protocol)) return route.abort();
      if (target.origin === origin && !/^\/(?:api|\.netlify)\//u.test(target.pathname)) return route.continue();
      // The site's existing decorative webfont is the sole external resource.
      if (target.protocol === "https:" && ["db.onlinewebfonts.com", "fonts.onlinewebfonts.com"].includes(target.hostname) && !target.username && !target.password && !target.port) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", () => errors.push("uncaught_script_error"));
    page.on("console", message => { if (message.type() === "error") errors.push("browser_console_error"); });
    page.on("response", response => { if (new URL(response.url()).origin === origin && response.status() >= 400) responses.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const cases = [];
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(origin + "/pages/our-partners.html", { waitUntil: "networkidle", timeout: 45000 });
      require(response?.ok() && new URL(page.url()).origin === origin && /^\/pages\/our-partners(?:\.html|\/)?$/u.test(new URL(page.url()).pathname), "browser_navigation_failed");
      await page.locator("[data-partner-list=grid] .sponsor-logo-link").first().waitFor();
      await page.locator("[data-partner-list=grid]").scrollIntoViewIfNeeded();
      require(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "browser_horizontal_overflow");
      for (const item of items) {
        const partner = PARTNERS[item.partner_id];
        const link = page.locator('[data-partner-list="grid"] a').filter({ has: page.locator(`img[src="${partner.asset.replace("BackPackKidzWebsite", "")}"]`) });
        require(await link.count() === 1 && await link.getAttribute("href") === partner.href, "browser_partner_url_changed");
        const img = link.locator("img");
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(image => image.decode());
        const info = await img.evaluate(image => ({ loaded: image.complete && image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight, alt: image.alt, box: { width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height } }));
        require(info.loaded && info.width === item.width && info.height === item.height && info.alt === item.metadata.alt && info.box.width > 0 && info.box.height > 0 && info.box.width <= width, "browser_partner_image_invalid");
      }
      await page.addScriptTag({ content: axe.source });
      const accessibility = await page.evaluate(async () => {
        const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) }));
      });
      cases.push({ width, accessibility, screenshot_sha256: sha(await page.screenshot({ fullPage: true })) });
    }
    const links = await page.locator("a[href]").evaluateAll(anchors => anchors.map(a => a.getAttribute("href")));
    require(links.every(value => value && !/^(?:javascript|data|vbscript):/iu.test(value)), "browser_link_scheme_invalid");
    return { schema: "partner_logo_browser_qa_v1", origin, items_sha256: sha(Buffer.from(canonicalJson(items))), cases, console_errors: errors, failed_resources: responses, passed: !errors.length && !responses.length && cases.every(value => !value.accessibility.length) };
  } finally { await browser.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    require(process.argv.length === 2, "browser_arguments_forbidden");
    let raw = "";
    for await (const chunk of process.stdin) { raw += chunk; require(raw.length <= 32000, "browser_input_oversized"); }
    const value = JSON.parse(raw);
    require(canonicalJson(value) === raw && Object.keys(value).sort().join() === "deploy_id,items" && /^[a-f0-9]{24}$/u.test(value.deploy_id), "browser_input_invalid");
    const result = await browserQa(`https://${value.deploy_id}--backpackkidz.netlify.app`, value.items);
    process.stdout.write(canonicalJson(result));
    if (!result.passed) process.exitCode = 1;
  } catch { process.stderr.write("partner_logo_browser_verification_failed\n"); process.exitCode = 1; }
}
