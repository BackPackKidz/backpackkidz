const { chromium } = require('playwright');

const BASE = 'http://localhost:8888';
const PAYPAL_ID = 'hosted_button_id=VSXH3DH6PUFH2';
const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function apiTests() {
  let r = await post('/api/contacts', {});
  ok('API contacts: empty -> 400 + fields', r.status === 400 &&
    JSON.stringify(r.data.fields) === '["name","email","message"]', JSON.stringify(r.data.fields));

  r = await post('/api/contacts', { name: 'QA Test', email: 'a@b', message: 'hi' });
  ok('API contacts: dotless email -> 400 [email]', r.status === 400 &&
    JSON.stringify(r.data.fields) === '["email"]', JSON.stringify(r.data.fields));

  r = await post('/api/contacts', {
    name: 'QA Test', email: 'qa-test@example.com', subject: 'Request a speaker',
    message: 'Local Phase 2 verification submission - safe to ignore.',
  });
  ok('API contacts: valid (speaker subject) -> 2xx', r.status >= 200 && r.status < 300, 'status ' + r.status);

  r = await post('/api/volunteers', {});
  ok('API volunteers: empty -> 400 + fields', r.status === 400 && Array.isArray(r.data.fields) &&
    r.data.fields.length > 0, JSON.stringify(r.data.fields));

  r = await post('/api/sponsorships', {});
  ok('API sponsorships: empty -> 400 + fields', r.status === 400 && Array.isArray(r.data.fields) &&
    r.data.fields.length > 0, JSON.stringify(r.data.fields));

  r = await post('/api/partners', {});
  ok('API partners: empty -> 400 + fields', r.status === 400 && Array.isArray(r.data.fields),
    JSON.stringify(r.data.fields));

  r = await post('/api/donations', { email: 'not-an-email' });
  ok('API donations: bad email -> 400 [email]', r.status === 400 &&
    JSON.stringify(r.data.fields || r.data.errors?.map((e) => e.field)) === '["email"]',
    JSON.stringify(r.data));

  r = await post('/api/donations', {});
  ok('API donations: empty (all optional) -> 2xx + paypal_url', r.status >= 200 && r.status < 300 &&
    String(r.data.paypal_url || '').includes(PAYPAL_ID), 'status ' + r.status + ' url ' + r.data.paypal_url);

  const get = await fetch(BASE + '/api/donations');
  ok('API donations: GET -> 405', get.status === 405, 'status ' + get.status);
}

async function successHidden(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-form-success], [data-donation-success]');
    return panel ? panel.hidden && panel.offsetParent === null : 'NO PANEL';
  });
}

function trackPosts(page) {
  const posts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/')) posts.push(req.url());
  });
  return posts;
}

async function genericFormTest(browser, label, path, fill, doubleSubmit) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const posts = trackPosts(page);
  await page.goto(BASE + path);
  await page.waitForTimeout(400);

  ok(`${label}: success panel hidden on load`, (await successHidden(page)) === true);

  // Empty submit: browser-native required validation must block the POST.
  await page.click('form[data-api-form] [type="submit"]');
  await page.waitForTimeout(500);
  ok(`${label}: empty submit blocked by native validation (no POST)`, posts.length === 0,
    posts.length + ' posts');

  // Server-side error mapping: "a@b" passes the browser but fails the server regex.
  await fill(page);
  await page.fill('input[name="email"]', 'a@b');
  await page.click('form[data-api-form] [type="submit"]');
  await page.waitForTimeout(1500);
  const serverErr = await page.evaluate(() => {
    const node = document.querySelector('[data-error-for="email"]');
    const field = document.querySelector('input[name="email"]');
    return {
      msg: node ? node.textContent.trim() : null,
      invalid: field ? field.getAttribute('aria-invalid') : null,
      describedby: field ? field.getAttribute('aria-describedby') : null,
    };
  });
  ok(`${label}: server 400 maps to inline error + aria`, posts.length === 1 && !!serverErr.msg &&
    serverErr.invalid === 'true' && !!serverErr.describedby, JSON.stringify(serverErr));
  ok(`${label}: success panel still hidden after error`, (await successHidden(page)) === true);

  // Clean submit -> success panel revealed and focused, form hidden.
  await page.fill('input[name="email"]', 'qa-test@example.com');
  if (doubleSubmit) {
    await page.evaluate(() => {
      const btn = document.querySelector('form[data-api-form] [type="submit"]');
      btn.click();
      btn.click();
    });
  } else {
    await page.click('form[data-api-form] [type="submit"]');
  }
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const panel = document.querySelector('[data-form-success]');
    const form = document.querySelector('form[data-api-form]');
    return {
      panelVisible: panel && !panel.hidden && panel.offsetParent !== null,
      formHidden: form && form.hidden,
      focusOnPanel: document.activeElement === panel,
    };
  });
  ok(`${label}: clean submit -> success visible, form hidden, focus moved`,
    after.panelVisible && after.formHidden && after.focusOnPanel, JSON.stringify(after));
  const expectedPosts = 2; // error attempt + clean submit (double click must still be 1)
  ok(`${label}: ${doubleSubmit ? 'double-click sent exactly one POST' : 'expected POST count'}`,
    posts.length === expectedPosts, posts.length + ' total posts');

  await ctx.close();
}

async function donationFormTest(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const posts = trackPosts(page);
  await page.goto(BASE + '/pages/donate');
  await page.waitForTimeout(400);

  ok('donate: success panel hidden on load', (await successHidden(page)) === true);

  // Client-side email format check blocks before any POST (form is novalidate).
  await page.fill('input[name="email"]', 'not-an-email');
  await page.click('form[data-donation-form] [type="submit"]');
  await page.waitForTimeout(600);
  const err = await page.evaluate(() => ({
    msg: (document.querySelector('[data-error-for="email"]') || {}).textContent?.trim(),
    invalid: document.querySelector('input[name="email"]')?.getAttribute('aria-invalid'),
  }));
  ok('donate: bad email -> client inline error, no POST', posts.length === 0 && !!err.msg &&
    err.invalid === 'true', JSON.stringify(err) + ' posts=' + posts.length);

  // Honor toggle reveals tribute fields.
  await page.check('[data-honor-toggle]');
  const honorVisible = await page.evaluate(
    () => !document.querySelector('[data-honor-fields]').hidden
  );
  await page.uncheck('[data-honor-toggle]');
  ok('donate: honor/memory toggle reveals fields', honorVisible === true);

  // Empty submit (all fields optional) with a rapid double-click -> exactly one POST,
  // success panel revealed with the PayPal continuation link.
  await page.fill('input[name="email"]', '');
  await page.evaluate(() => {
    const btn = document.querySelector('form[data-donation-form] [type="submit"]');
    btn.click();
    btn.click();
  });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const panel = document.querySelector('[data-donation-success]');
    const form = document.querySelector('form[data-donation-form]');
    const link = panel ? panel.querySelector('[data-paypal-link]') : null;
    return {
      panelVisible: panel && !panel.hidden && panel.offsetParent !== null,
      formHidden: form && form.hidden,
      focusOnPanel: document.activeElement === panel,
      paypalHref: link ? link.href : null,
    };
  });
  ok('donate: empty optional submit -> success + PayPal link', after.panelVisible && after.formHidden &&
    String(after.paypalHref).includes('hosted_button_id=VSXH3DH6PUFH2'), JSON.stringify(after));
  ok('donate: focus moved to success panel', after.focusOnPanel === true);
  ok('donate: double-click sent exactly one POST', posts.length === 1, posts.length + ' posts');

  await ctx.close();
}

async function sponsorCalcTest(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/pages/sponsor');
  await page.fill('[data-sponsor-count]', '2');
  await page.waitForTimeout(300);
  const total = await page.textContent('[data-sponsor-total]');
  ok('sponsor: live calc 2 children -> $640', total.trim() === '$640', total.trim());
  await ctx.close();
}

(async () => {
  await apiTests();
  const browser = await chromium.launch();
  await genericFormTest(browser, 'contact', '/pages/contact', async (page) => {
    await page.fill('input[name="name"]', 'QA Test');
    await page.selectOption('select[name="subject"]', 'Request a speaker');
    await page.fill('textarea[name="message"]', 'Local Phase 2 verification - safe to ignore.');
  }, true);
  await genericFormTest(browser, 'volunteer', '/pages/get-involved', async (page) => {
    await page.fill('input[name="firstName"]', 'QA');
    await page.fill('input[name="lastName"]', 'Test');
  }, false);
  await genericFormTest(browser, 'sponsor', '/pages/sponsor', async (page) => {
    await page.fill('input[name="sponsorName"]', 'QA Test');
    await page.fill('input[name="numberOfChildren"]', '1');
  }, false);
  await donationFormTest(browser);
  await sponsorCalcTest(browser);
  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})();
