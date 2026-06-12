# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Overview

This is the production website for **Back Pack Kidz** (https://www.backpackkidz.com/), a 501(c)(3) nonprofit (legal entity on the FL DR-14 certificate: "The Yah Yah Girls Inc") that fights weekend childhood hunger in Charlotte County, Florida. Volunteers pack weekend food bags distributed through all 13 county elementary schools (plus middle/high school pantries), serving 1,000+ children per week since 2010.

The site serves donors, parents, volunteers, churches, schools, sponsors, and community partners. It must always feel clean, warm, trustworthy, professional, and donor-friendly — and it must work well on phones.

**This is not a redesign project.** Preserve the current visual direction unless a task explicitly asks for UI changes. Most work here is reliability, accessibility, SEO, responsiveness, donation flow, form/backend behavior, and content polish.

## 2. Website Architecture

Static HTML/CSS/JS frontend (no framework, no bundler, no build step) + Netlify Functions backend. Deployed on Netlify from GitHub (`github.com/BackPackKidz/backpackkidz`). **Pushing to `origin/main` triggers a production deploy.**

- Frontend: hand-written HTML pages, one shared stylesheet, one shared script.
- Backend: Netlify Functions (ESM, `Response`-based handlers) storing form submissions in **Netlify Blobs**, with fail-soft email notifications (nodemailer) and fail-soft Google Sheets bookkeeping.
- Payments: handled entirely by PayPal (hosted donate button / classic Donations flow). The site never touches card data.
- Forms post JSON to `/api/*`, which `netlify.toml` rewrites to `/.netlify/functions/*`.

### Key commands

```
npm test          # node --test over tests/*.test.mjs (donation/email/paypal utils)
npm run dev       # netlify dev — serves the site AND functions locally
npm run build     # no-op (static site; nothing to build)
```

- Node 24 / npm. Only three runtime deps: `@netlify/blobs`, `@sentry/browser`, `nodemailer`.
- There is no linter or formatter configured. Match the existing style by hand.
- For visual verification, Playwright 1.60 + Chromium are available via the npx cache (no local install). Pattern that works: write a `.cjs` script using `require('playwright')` and run it with `$env:NODE_PATH = "<npx-cache>/node_modules"`. Pages render fine from `file://` URLs; use `reducedMotion: 'reduce'` in the browser context so `[data-reveal]` content is visible in full-page screenshots.

### Git warning (important)

`BackPackKidzWebsite/.git` is a **stale nested git repo**. A bare `git add/commit` with cwd inside that folder commits to the wrong repo. Always run git against the real repo root explicitly: `git -C f:/backpackkidz.com/main ...`. Also run `git pull --ff-only` before diagnosing "missing" code — the local checkout has been behind origin before.

## 3. File and Folder Structure

```
/                          repo root
├── netlify.toml           publish dir, functions dir, /api/* rewrite, WordPress-era 301s
├── .env.example           documented env vars (the only place secrets are described)
├── package.json           scripts + backend deps
├── notes.txt              owner's running to-do notes
├── tests/                 node --test unit tests for netlify/ utils
├── netlify/
│   ├── functions/         deployed endpoints:
│   │   ├── contacts.js, donations.js, sponsorships.js, volunteers.js, partners.js
│   │   ├── paypal-ipn.js              (PayPal IPN listener — marks donations Completed)
│   │   └── *-export.mjs               (token-gated CSV exports, one per record type)
│   └── *.mjs              shared utils: donation-utils, contact-utils, sponsorship-utils,
│                          volunteer-utils, partner-utils, email-utils, paypal-utils,
│                          google-sheets-utils, csv-utils
└── BackPackKidzWebsite/   ← Netlify publish directory (everything public lives here)
    ├── index.html         home page
    ├── 404.html           custom 404 (uses absolute paths — served at any URL depth)
    ├── style.css          THE stylesheet — all pages share it; design tokens at the top
    ├── script.js          THE script — all pages share it
    ├── robots.txt, sitemap.xml
    ├── assets/            images (logo, hero WebP + PNG, community art, sponsor logos)
    ├── pages/             all sub-pages (about, programs, sponsor, gallery, our-partners,
    │                      contact, get-involved, donate, faq, future-events)
    ├── scripts/, styles/  EMPTY legacy folders — do not put new files here
    └── .git/              stale nested repo — do not commit into it
```

There are no reusable component/template files: the header, nav, and footer are duplicated in each HTML page. A change to shared chrome (nav links, footer columns, donate links) must be applied to **every page**, including `404.html`.

## 4. Page Structure

Every page follows the same skeleton: skip link → `header.site-header` with `nav.navbar` (logo, `.nav-toggle` hamburger, `.nav-panel` with `.nav-menu` + `.nav-actions`) → `main#content` of `section.section` blocks each wrapping a `.section-inner` → floating donate link → `footer.site-footer`. Sub-pages set `aria-current="page"` on their nav link.

- Section content patterns: `.section-heading` (centered) / `.section-heading-left`, card grids (`.feature-grid`, `.impact-grid`, `.tier-grid`, `.gallery-grid`…), split layouts (`.split-grid`, `.page-hero-grid`), dark panels (`.support-panel-dark`, `.page-hero-aside`), and form shells (`.form-shell`, `.form-layout`).
- Reveal-on-scroll uses `data-reveal`; parallax uses `.parallax-layer` + `data-parallax-section`/`data-parallax-speed`. Both are progressive enhancements handled by `script.js` and disabled under reduced motion.
- New sub-pages: put them in `pages/`, reuse existing section classes, add the page to `sitemap.xml` (extensionless URL, e.g. `/pages/new-page`), and link it from nav/footer only if the owner wants it surfaced.

## 5. Styling Standards

All styling lives in `BackPackKidzWebsite/style.css`. Design tokens are defined in `:root` at the top — use them; do not hard-code colors, radii, or shadows.

- **Solid colors vs gradients (this has broken the site before):** `--orange`, `--orange-dark`, `--navy` are solid colors for `color`, `border-color`, `outline`, `box-shadow`, `accent-color`, and gradient stops. `--grad-orange` and `--grad-purple` are the brand gradients and are valid **only in background slots**. Never put a gradient in a property that takes a `<color>` — the browser silently drops the declaration and you get invisible white-on-white text.
- Buttons are pill-shaped (`border-radius: 999px`): `.button-primary` (orange gradient, the donate style), `.button-secondary` (white/bordered), `.button-light` / `.button-outline-light` (on dark bands), `.button-text`. Reuse these; don't invent new button styles.
- Layout rhythm: `.section` padding, `.section-inner` at `min(var(--max-width), 92%)`, cards with `var(--radius-md)` + `var(--shadow)` and the shared hover lift. Header height is driven by `--header-height` (82px desktop, 74px ≤1100px, 72px ≤480px) — the navbar, nav panel, and `scroll-padding-top` all derive from it; keep them in sync via the token, not literals.
- Breakpoints: **1100px** (nav collapses to hamburger; grids stack), 900px (form layouts), 640px (type scale, full-width buttons, static hero/story cards), 480px (small tweaks). Don't add new breakpoint values without reason.
- Keep the warm nonprofit look: white/soft-orange surfaces, purple headings, orange CTAs, purple gradient bands. Donation CTAs must stay visually prominent. No flashy effects; animations stay subtle and must respect `prefers-reduced-motion` (a global reduced-motion block already exists — don't bypass it).
- Avoid duplicate CSS: search for an existing class before writing a new one. Page-scoped styles use a body class prefix (see `.donate-page …`).

## 6. JavaScript Standards

All frontend behavior lives in `BackPackKidzWebsite/script.js`, loaded with `defer` on every page. It is plain, dependency-free, defensive ES2020 (`instanceof` guards, optional chaining, try/catch around risky DOM work). Keep it that way.

- Behavior is opt-in via data attributes: `[data-donate-link]` (forced to `/pages/donate.html`), `[data-paypal-link]` (forced to the PayPal URL), `[data-api-form]`, `[data-donation-form]`, `[data-reveal]`, `[data-sponsor-calc]`, etc. New behavior should follow this pattern so pages without the markup are unaffected.
- The generic `[data-api-form]` handler posts a form's named fields as JSON to its `action`, disables the submit button while in flight, maps server `fields: []` errors onto `[data-error-for]` nodes with `aria-invalid`/`aria-describedby`, and swaps form → `[data-form-success]` panel on success. Wire new forms into this handler instead of writing bespoke fetch code.
- The sponsor cost constant appears in **three places that must match**: `COST_PER_CHILD` in `netlify/sponsorship-utils.mjs`, `data-cost-per-child="320"` in `pages/sponsor.html`, and the `|| 320` fallback in `script.js`.
- No frontend secrets, ever. The only tokens the frontend handles are user-entered export tokens sent as `Authorization: Bearer` headers. Never log donor data to the console.

## 7. Form and Backend Standards

Forms are the highest-risk part of the site. Current forms: donation info (`donate.html` → `/api/donations`), contact (`contact.html` → `/api/contacts`), volunteer (`get-involved.html` → `/api/volunteers`), sponsor (`sponsor.html` → `/api/sponsorships`). `/api/partners` exists as an endpoint but no form posts to it yet.

- Success and error UI must be **hidden by default** (`hidden` attribute; CSS has a global `[hidden] { display: none !important; }` guard) and only shown after a confirmed server response. Success panels use `role="status"` / `aria-live="polite"` and receive focus on reveal. Preserve this pattern exactly.
- Validation: browser `reportValidity()` first, then server-side validation in the `*-utils.mjs` record creators (sanitized single/multi-line fields with length caps). Client and server messages map to `[data-error-for="field"]` nodes. Donation form fields are **all optional by owner decision** — only entered emails are format-checked.
- Functions are fail-soft by design: the Blobs save is the only hard requirement; email notification and Google Sheets mirroring log errors but never block the user. Keep that ordering when modifying functions.
- Notification emails route via `netlify/email-utils.mjs` and no-op until `SMTP_USER`/`SMTP_PASS` are set in Netlify env. Default recipients are per-type (`donate@`, `contact@`, `partners@backpackkidz.com` — see `.env.example`).
- CSV exports (`/api/<type>/export`) require a per-type `*_EXPORT_TOKEN` env var and a matching Bearer token. They expose donor PII — never weaken the token check or add an unauthenticated listing endpoint.
- Do not visually change forms, rename field `name`s, or alter endpoints unless the task requires it — field names are contracts shared by HTML, `script.js`, the utils, the CSV exports, and the Sheets columns.

## 8. Netlify and Deployment Standards

`netlify.toml` defines: publish dir `BackPackKidzWebsite`, functions dir `netlify/functions`, the `/api/*` → functions rewrite, and 301 redirects for old WordPress-era URLs (`/about-us/*`, `/donate-now/*`, etc. — order matters: specific children before broad wildcards).

- Do not break or reorder existing redirects; if you change them, test both old and new URLs after deploy.
- Secrets live only in Netlify environment variables (Site settings → Environment variables), documented in `.env.example`. Never commit `.env*` (gitignored, except the example), never hard-code credentials anywhere.
- Test functions locally with `netlify dev` before pushing. Remember serverless constraints: stateless, short-lived, no local disk persistence — durable state goes in Netlify Blobs.
- **A push to `main` is a production deploy.** Do not push without the owner's go-ahead. After deploy, spot-check the live site (deploy logs are in the Netlify dashboard).
- Sitemap URLs are extensionless (`/pages/about`) relying on Netlify pretty URLs; keep new entries consistent.

## 9. Donation Flow Standards

The donation pipeline (do not weaken any step):

1. Donor optionally fills the donation info form → `POST /api/donations` saves a **Pending** record to Blobs, mirrors a Pending row to Google Sheets (fail-soft), and returns a PayPal URL.
2. Donor pays on PayPal. With `PAYPAL_BUSINESS` set, the classic Donations flow passes the amount, donation ID (`custom`), and `notify_url`; without it, the hosted button link is used and account-wide IPN must be enabled in PayPal.
3. PayPal POSTs to `netlify/functions/paypal-ipn.js`, which echoes the raw body back for the `_notify-validate` handshake and proceeds **only on "VERIFIED"**, dedupes by `txn_id`, then flips the record (and the Sheets row) to **Completed**.

Rules:

- `paypal-ipn.js` is the **only** place a donation is ever marked Completed. The frontend and the intent endpoint must never claim payment success; submitting the info form is not a donation.
- Keep the direct PayPal path prominent. The hosted button URL is `https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2` — **never change or break it** unless the owner explicitly provides a replacement. It appears in `script.js`, `donate.html`, and as the `PAYPAL_DONATION_URL` default.
- Never collect or store card numbers; PayPal (or another hosted provider, if the owner ever chooses one) handles all payment data.
- Donor detail fields stay optional. Their purpose is thank-you notes, tribute messages, bookkeeping, and follow-up — not payment.
- Do not invent donation amounts, sponsor costs, tax claims, or receipt wording. Verified amounts: **$10 feeds a child for a weekend; $320 for a school year**.
- If you change payment automation, include explicit testing instructions (PayPal sandbox is supported via `PAYPAL_ENV=sandbox`).

## 10. Donor Data and Privacy Rules

- Treat donor name, email, phone, address, donation amount, tribute messages, and recognition preferences as sensitive. They live in Netlify Blobs and the private Google Sheet only — never render them publicly unless the donor explicitly opted into public recognition.
- Never expose credentials in frontend code or commit them: SMTP passwords, Google service-account private keys, API keys, PayPal secrets, export tokens. All of these are Netlify env vars.
- Keep privacy/help text near forms (the donate form already explains why details are collected); add similar notes to new forms.
- Never build features that reveal information about individual children. Sponsorship language is program-level ("sponsor a child's weekend food for a year"), never about specific, identifiable kids.

## 11. SEO Standards

Existing conventions (keep them on every page, including new ones): unique `<title>` ("Page Name | Back Pack Kidz"), unique meta description, `rel="canonical"` to the `www.backpackkidz.com` URL, Open Graph + `twitter:card` tags, one `<h1>` per page with a logical heading order, descriptive alt text, `robots.txt` pointing at `sitemap.xml`, and JSON-LD (`NonprofitOrganization` schema on the home page).

- Update `sitemap.xml` when adding or removing pages.
- Use local nonprofit keywords naturally where they fit the copy: Back Pack Kidz, Charlotte County, children's charity, weekend hunger, backpack food program, food insecurity, donate, volunteer, sponsor a child, school pantry, weekend food bags, nonprofit. **Do not keyword-stuff.**
- Schema/structured data may only contain verified facts. The org schema deliberately omits the EIN (`taxID`) until the owner provides it — do not fill it with the DR-14 certificate number.
- `404.html` keeps `noindex` and absolute asset paths.

## 12. Accessibility Standards

The site has a real accessibility baseline — every change must preserve or improve it:

- Semantic HTML, logical heading order, skip link to `#content`, `aria-label`s on nav landmarks, `aria-current="page"` on the active nav link.
- Hamburger button manages `aria-expanded` + a live `.sr-only` label; Escape closes the panel; the panel scroll-locks the page on mobile.
- Forms: every input has a `<label for>`, errors tie to fields via `aria-invalid` + `aria-describedby`, status text uses `aria-live="polite"`, success panels get focus on reveal.
- Visible focus styles (`:focus-visible` outlines) exist for every interactive element — never remove them. Tap targets are ≥44px.
- Color contrast: white text belongs on the purple/orange gradients' dark regions; check contrast when placing text near the light pink end of `--grad-purple` or the yellow end of `--grad-orange`.
- Reduced motion: reveal/parallax/floating-button animation all check `prefers-reduced-motion`; new motion must too.

## 13. Performance Standards

The home and donate pages have scored Lighthouse mobile 100/100/100/100 — protect that.

- Images: compress, prefer WebP (hero is a 31KB WebP with `fetchpriority="high"`; **keep the PNG for `og:image`** since some scrapers don't handle WebP). Below-fold images use `loading="lazy"`. Always set `width`/`height` to avoid layout shift.
- No new JS/CSS dependencies for the frontend; no trackers or heavy embeds without owner sign-off. Keep `script.js` doing work in `requestAnimationFrame` with passive listeners, as it does now.
- Avoid CSS bloat: reuse classes, delete styles that become unused.
- Key pages to test when performance-relevant changes land: Home, Donate, Contact, Sponsor, Get Involved, Gallery, Our Partners, FAQ, Events.

## 14. Content and Copywriting Standards

Copy must read human, clear, and warm — emotionally honest without being manipulative, donor- and community-focused, plain English. Not stiff, not generic, not obviously AI-written (avoid "nestled", "vibrant", "empower your journey"-style filler).

- Preferred themes: feeding children, weekend food support, Charlotte County community, volunteers, schools, churches, local partners, donor trust, hope, practical impact.
- Never invent facts, statistics, names, or testimonials. Missing real-world details get an HTML comment TODO addressed to the owner (existing pattern: `<!-- TODO (owner): ... -->`).
- Verified facts safe to use: 1,000+ children fed weekly; 13 elementary schools; serving since 2010; 100% volunteer run; $10/weekend and $320/school-year; mailing address 1133 Bal Harbor Blvd. Suite 1139, PMB #148, Punta Gorda, FL 33950.
- Real mailboxes: `donate@`, `hello@`, `support@`, `partners@`, `contact@backpackkidz.com`. **`info@backpackkidz.com` does not exist — never use it.**

## 15. Nonprofit Trust and Legal Information Rules

Never invent or assume: EIN, tax-deductibility wording, legal nonprofit name, phone number, leadership/board names, testimonials, partner or sponsor status, impact statistics, financial claims.

- 501(c)(3) status **is** owner-confirmed (DR-14 certificate + brochure), and the existing tax-deductible line on the donate page is approved. Do not extend it into receipt language or specific tax advice.
- **The EIN is still unknown. The Florida DR-14 certificate number is not an EIN — never publish it as one.** The placeholder pattern is already in the code: see the TODO comments in `index.html` and `donate.html`.
- The "100% of your donation" / "zero administrative costs" claims are owner-approved as currently written; do not expand or reword them without sign-off.
- Partner/sponsor logos on `our-partners.html` are the approved set; adding a new logo requires owner confirmation (`TODO: Confirm whether this partner logo is approved for public use.`).
- When information is missing, write a TODO or ask the owner — e.g. `TODO: Verify EIN before publishing.`

## 16. Testing Checklist

After any meaningful change, run through (locally via `netlify dev`, or via screenshots for pure CSS/HTML work):

- All pages load: Home, About, Programs, Sponsor, Gallery, Our Partners, Contact, Get Involved, Donate, FAQ, Events, and the 404 page.
- Mobile nav opens, closes (button, link tap, Escape), and doesn't gap below the header.
- Header and footer links work on a sub-page (paths are absolute `/pages/...`) and on the 404 page.
- Donate buttons/links resolve to `/pages/donate.html`, and PayPal buttons to the correct hosted-button URL.
- Each form validates (bad email, then a clean submit), success panels are hidden on load and only show after a 2xx response, errors show only on actual failure, and double-submission is blocked.
- No placeholder/lorem text visible; no console errors; no donor data or secrets in page source or console.
- Layout holds at ~390px, ~768px, ~1024px, and a wide desktop; keyboard tab order works and focus rings are visible.
- Title/description/canonical present on any touched page; `sitemap.xml` updated if pages changed.
- `npm test` passes if anything under `netlify/` changed.
- After deploy: Netlify deploy succeeded and the changed pages render live.

## 17. Agent Workflow Rules

1. Inspect the relevant files before editing — don't trust assumptions or stale memory (run `git -C <root> pull --ff-only` first if things look missing).
2. Say which files you'll change and why.
3. Make the smallest safe change; preserve the existing UI unless asked to alter it.
4. Don't touch unrelated files or reformat whole files.
5. Don't invent nonprofit facts; leave owner TODOs.
6. Protect donor data and credentials at every step.
7. Test (or describe exact testing steps) using section 16.
8. Summarize what changed, file by file.
9. List remaining TODOs or information only the owner can provide.
10. Commit/push only with the owner's permission — a push to `main` deploys to production.

## 18. Things Agents Must Never Do

- Hard-code credentials anywhere, commit `.env` files, or put SMTP passwords, Google private keys, API keys, export tokens, or PayPal secrets in frontend code.
- Invent EIN, tax, legal, board, partner, sponsor, statistic, or testimonial details — or publish the DR-14 number as an EIN.
- Add tax-deductibility or "100% of donations" claims beyond the owner-approved wording.
- Break, replace, or obscure the PayPal donation link (`hosted_button_id=VSXH3DH6PUFH2`).
- Mark a donation Completed anywhere except `paypal-ipn.js` after a VERIFIED IPN, or present the info-form success panel as payment confirmation.
- Expose donor records publicly or weaken the export-token checks.
- Remove accessibility features (focus styles, labels, aria wiring, reduced-motion handling) or form validation.
- Delete or reorder redirects without confirming replacement behavior.
- Redesign the site, change brand colors/gradients, or make broad visual changes without explicit permission.
- Put gradient tokens into `<color>`-only CSS slots (this has silently blanked whole sections before).
- Add dependencies, frameworks, or build steps to the frontend.
- Change `netlify.toml` or deployment settings casually, or push to `main` untested.
- Commit from inside `BackPackKidzWebsite/.git`.
- Use `info@backpackkidz.com` (it doesn't exist).

## 19. Common Future Tasks

Likely owner requests, roughly in current priority order (see also `notes.txt` and `<!-- TODO (owner) -->` comments in the HTML):

- Owner-side env setup still pending: `SMTP_USER`/`SMTP_PASS` (form emails), `GOOGLE_SHEETS_*` (bookkeeping), `PAYPAL_BUSINESS` + account-wide IPN (donation matching). Code paths already exist and fail soft until these are set.
- Publish the EIN once provided (donate page TODO + `taxID` in the home-page schema).
- Add real gallery photos (gallery has placeholder tiles) and verified partner content.
- Restore footer social links when official profiles exist (commented block in each page's footer).
- Add a phone number to the footer once confirmed.
- Wire a partner inquiry form to the existing `/api/partners` endpoint.
- Add analytics events for donate clicks and form submissions (owner sign-off required for any tracker).
- Donation goal tracker / live impact stats (verified numbers only).
- PayPal amount prefill, speaker-request form, event signup, sponsor tier refinements.
- An admin page for the token-gated CSV exports (`script.js` already supports `[data-export-form]`; no page currently uses it).

## 20. Final Development Philosophy

This site is a small nonprofit's public face and donation pipeline, maintained by volunteers and agents. Every change should make it more trustworthy, not just prettier: accurate facts, working forms, a donation path that never lies about payment status, accessibility that doesn't regress, and small reviewable diffs. When unsure whether something is true about the organization, it isn't — ask the owner or leave a TODO. When unsure whether a change is wanted, make the smaller version of it.
