// Local read-only rendered audit. No form submission or production URL support.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import axe from 'axe-core';
import { PNG } from 'pngjs';

const root = resolve(process.env.BPK_AUDIT_ROOT || resolve(import.meta.dirname, '../..'));
const output = resolve(process.env.BPK_AUDIT_OUTPUT || resolve(tmpdir(), 'backpackkidz-contrast-audit'));
const baseline = '8029a0a6b1708f74f95223e237459f8de48ad009';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const corrected = '.partners-note-panel > p, .recognition-card > span, .partner-impact-card > .feature-icon, .eyebrow, .support-panel > p, .support-panel > p > a, .nav-menu a[aria-current="page"]';
const git = (...args) => execFileSync('git', ['-C', root, ...args]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
mkdirSync(output, { recursive: true });
const cache = new Map();
const tracked = new Set(git('ls-tree', '-r', '--name-only', baseline, '--', 'BackPackKidzWebsite').toString().trim().split('\n'));
let mode = 'baseline';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const relative = 'BackPackKidzWebsite' + (path === '/' ? '/index.html' : path);
  const file = resolve(root, relative);
  if (request.method !== 'GET' || !file.startsWith(resolve(root, 'BackPackKidzWebsite') + sep)) return response.writeHead(403).end();
  let bytes;
  if (mode === 'baseline' && tracked.has(relative)) {
    if (!cache.has(relative)) cache.set(relative, git('show', baseline + ':' + relative));
    bytes = cache.get(relative);
  } else if (mode !== 'baseline' && existsSync(file) && statSync(file).isFile()) bytes = readFileSync(file);
  if (!bytes) return response.writeHead(404).end();
  response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  response.end(bytes);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const report = { baseline_head: baseline, source_head: git('rev-parse', 'HEAD').toString().trim(), browser: browser.version(), axe: axe.version, source_css_sha256: sha(readFileSync(resolve(root, 'BackPackKidzWebsite/style.css'))), cases: [] };
const snapshots = new Map();
const audit = page => page.evaluate(async () => {
  const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
  return { violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary, checks: n.any.map(c => ({ id: c.id, data: c.data })) })) })), incomplete: result.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })) };
});
const targetContrast = page => page.locator(corrected).evaluateAll(elements => {
  const channels = value => value.match(/[\d.]+/g).map(Number);
  const luminance = color => color.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  return elements.filter(el => el.getClientRects().length).map(el => {
    const style = getComputedStyle(el), layers = [];
    for (let parent = el; parent; parent = parent.parentElement) {
      const layer = getComputedStyle(parent);
      if (layer.backgroundImage !== 'none') throw new Error('Gradient requires separate contrast assessment');
      layers.unshift(channels(layer.backgroundColor));
      if ((layers[0][3] ?? 1) === 1) break;
    }
    const background = layers.reduce((under, over) => over.slice(0, 3).map((v, i) => v * (over[3] ?? 1) + under[i] * (1 - (over[3] ?? 1))), [255, 255, 255]);
    const values = [luminance(channels(style.color)), luminance(background)].sort((a, b) => b - a);
    return { text: el.textContent.trim(), color: style.color, background, ratio: (values[0] + 0.05) / (values[1] + 0.05), focusVisible: el.matches(':focus-visible'), outline: style.outline };
  });
});
const severe = result => result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).flatMap(v => v.nodes.map(n => v.id + ':' + n.target.join('|')));
function compareImages(before, after, rectangles) {
  const old = PNG.sync.read(before), current = PNG.sync.read(after);
  assert.equal(current.width, old.width); assert.equal(current.height, old.height);
  let changedPixels = 0, outsideTargets = 0;
  for (let y = 0; y < old.height; y++) for (let x = 0; x < old.width; x++) {
    const p = (y * old.width + x) * 4;
    if (old.data.subarray(p, p + 4).equals(current.data.subarray(p, p + 4))) continue;
    changedPixels++;
    if (!rectangles.some(r => x >= Math.floor(r.x) - 1 && x <= Math.ceil(r.x + r.width) + 1 && y >= Math.floor(r.y) - 1 && y <= Math.ceil(r.y + r.height) + 1)) outsideTargets++;
  }
  assert.equal(outsideTargets, 0, 'Pixel changes must be confined to the corrected text rectangles');
  return { changedPixels, outsideTargets };
}
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() !== 'GET') return route.abort();
    if (url.origin === origin && !/^\/(?:api|\.netlify)\//u.test(url.pathname)) return route.continue();
    if (url.protocol === 'https:' && ['db.onlinewebfonts.com', 'fonts.onlinewebfonts.com'].includes(url.hostname)) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  for (mode of process.argv.includes('--baseline-only') ? ['baseline'] : ['baseline', 'candidate']) {
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(origin + '/pages/our-partners.html', { waitUntil: 'networkidle' });
      assert(response.ok());
      await page.locator('[data-partner-list="grid"] a').first().waitFor();
      await page.evaluate(async () => { await document.fonts.ready; for (const img of document.images) { if (img.loading === 'lazy') img.loading = 'eager'; await img.decode().catch(() => {}); } });
      await page.addScriptTag({ content: axe.source });
      const result = await audit(page);
      if (mode === 'baseline') assert.equal(result.violations.find(v => v.id === 'color-contrast').nodes.length, width === 1440 ? 17 : 16);
      const targetStyles = await page.evaluate(selectors => selectors.map(selector => {
        const el = document.querySelector(selector), style = getComputedStyle(el);
        return { selector, text: el.textContent.trim(), color: style.color, background: style.background, fontSize: style.fontSize, fontWeight: style.fontWeight, tag: el.tagName };
      }), result.violations.flatMap(v => v.nodes.flatMap(n => n.target)));
      const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
      writeFileSync(resolve(output, `${mode}-${width}.png`), screenshot);
      const geometry = await page.locator('body *').evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, attributes: [...el.attributes].map(a => [a.name, a.value]), text: el.children.length ? null : el.textContent, x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      const rectangles = await page.locator(corrected).evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      const states = [{ state: 'default', contrast: await targetContrast(page), ...result }];
      for (const selector of ['.partners-note-panel', '.recognition-grid', '.partner-impact-grid', '.support-panel']) {
        await page.locator(selector).screenshot({ path: resolve(output, `${mode}-${width}-${selector.slice(1)}.png`), animations: 'disabled' });
      }
      const cards = page.locator('.recognition-card, .partner-impact-card');
      for (let i = 0; i < await cards.count(); i++) {
        await cards.nth(i).hover();
        states.push({ state: `card-${i + 1}-hover`, contrast: await targetContrast(page) });
      }
      const links = page.locator('.support-panel > p > a');
      for (let i = 0; i < await links.count(); i++) {
        const link = links.nth(i);
        for (const state of ['hover', 'focus', 'active']) {
          await link.hover();
          if (state === 'focus') { await page.keyboard.press('Tab'); await link.focus(); }
          if (state === 'active') await page.mouse.down();
          assert(await link.evaluate((el, state) => el.matches(':' + (state === 'focus' ? 'focus-visible' : state)), state), `Browser must enter ${state}`);
          states.push({ state: `link-${i + 1}-${state}`, contrast: await targetContrast(page), ...await audit(page) });
          if (state === 'active') { await page.mouse.move(0, 0); await page.mouse.up(); }
          await link.evaluate(el => el.blur());
        }
      }
      await page.evaluate(() => scrollTo(0, 0));
      if (width < 1101) await page.locator('.nav-toggle').click();
      const currentLink = page.locator('.nav-menu a[aria-current="page"]');
      const navScreenshots = new Map();
      for (const state of ['default', 'hover', 'focus', 'active']) {
        if (state === 'default') await page.mouse.move(0, 0); else await currentLink.hover();
        if (state === 'focus') { await page.keyboard.press('Tab'); await currentLink.focus(); }
        if (state === 'active') await page.mouse.down();
        if (state !== 'default') assert(await currentLink.evaluate((el, state) => el.matches(':' + (state === 'focus' ? 'focus-visible' : state)), state));
        const contrast = await targetContrast(page);
        const navRect = await currentLink.boundingBox();
        const stateRectangles = await page.locator(corrected).evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
        }));
        const bytes = await page.screenshot({ animations: 'disabled' });
        writeFileSync(resolve(output, `${mode}-${width}-nav-${state}.png`), bytes);
        navScreenshots.set(state, { bytes, rect: navRect, rectangles: stateRectangles });
        states.push({ state: `nav-${state}`, contrast, ...await audit(page) });
        if (state === 'active') { await page.mouse.move(0, 0); await page.mouse.up(); }
        await currentLink.evaluate(el => el.blur());
      }
      if (width < 1101) await page.locator('.nav-toggle').click();
      // Corrected elements are static text or anchors: none has a disabled state.
      assert.equal(await page.locator(corrected).evaluateAll(elements => elements.some(el => 'disabled' in el)), false);
      const item = { mode, width, ...result, targetStyles, states, screenshot_sha256: sha(screenshot), geometry_sha256: sha(JSON.stringify(geometry)), horizontal_overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) };
      assert.equal(item.horizontal_overflow, false);
      if (mode === 'baseline') snapshots.set(width, { item, geometry, screenshot, navScreenshots });
      else {
        const before = snapshots.get(width);
        assert.deepEqual(geometry, before.geometry, 'Content, attributes and every element rectangle must be unchanged');
        for (const state of states) {
          assert.equal(state.contrast.length, width === 1440 || state.state.startsWith('nav-') ? 17 : 16);
          assert(state.contrast.every(c => c.ratio >= 4.5), `${width}/${state.state}: corrected text must exceed 4.5:1`);
          if (state.violations) {
            const original = before.item.states.find(s => s.state === state.state);
            const existing = new Set(severe(original));
            assert.deepEqual(severe(state).filter(key => !existing.has(key)), [], `${width}/${state.state}: no new serious/critical failures`);
            assert.equal(state.violations.filter(v => v.id === 'color-contrast').length, 0, `${width}/${state.state}: contrast failures must be zero`);
          }
        }
        item.visual = { ...compareImages(before.screenshot, screenshot, rectangles), identicalGeometry: true, navigationStates: {} };
        for (const [state, current] of navScreenshots) {
          const original = before.navScreenshots.get(state);
          assert.deepEqual(current.rect, original.rect, 'Current-page navigation rectangle must not move');
          assert.deepEqual(current.rectangles, original.rectangles, 'State-specific target geometry and scroll position must match');
          // Use viewport rectangles after menu expansion/keyboard scrolling.
          item.visual.navigationStates[state] = compareImages(original.bytes, current.bytes, current.rectangles);
        }
      }
      report.cases.push(item);
      console.log(JSON.stringify({ mode, width, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length })) }));
    }
  }
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
