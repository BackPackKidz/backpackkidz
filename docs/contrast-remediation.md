# Partners page contrast remediation

This source-only candidate changes two color declarations, scoped to the
partners page. It preserves layout, content, forms, navigation, images and
partner-logo behavior. No runtime or provider setting changes are included.

## Independent baseline

Baseline main: `8029a0a6b1708f74f95223e237459f8de48ad009`.
Baseline tree: `d6dbd54671f016a83c8be46cd121d675d1c16dda`.
The audit serves that commit's tracked website files directly with `git show`;
it does not derive the baseline from PR #9 or run a production site.

The 17 authorized Axe contrast targets (the original 16 plus the separately
authorized current-page navigation target) are:

| Targets | Count | Baseline foreground/background | Baseline ratio |
| --- | ---: | --- | ---: |
| `.partners-note-panel > p` | 1 | `#64748b` / `#fff7ed` | 4.48 |
| `.recognition-card > span` (01–05) | 5 | `#ea580c` / `#fff7ed` | 3.35 |
| `.partner-impact-card > .feature-icon` (01–06) | 6 | `#ea580c` / `#fff7ed` | 3.35 |
| `.eyebrow` | 1 | `#ea580c` / composited `#fef0e5` | 3.18 |
| `.support-panel > p` and its donation/sponsor links | 3 | `#64748b` / `#fff7ed` | 4.48 |
| `.nav-menu a[aria-current="page"]` | 1 | `#ea580c` / `#ffffff` (desktop) | 3.55 |

Warm-panel prose becomes `#5f6f86`; orange small text and the partners page's
current-page navigation link become `#c2410c`. Navigation structure, link,
underline, dimensions and responsive behavior are unchanged.
The measured minimum across corrected targets/states is 4.6308:1, above 4.5:1.

## Validation

Run with Node 20 or newer and Git, from repository root:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm ci --ignore-scripts --prefix tools/contrast-audit
npx --prefix tools/contrast-audit playwright install chromium
node tools/contrast-audit/audit.mjs
```

`BPK_AUDIT_OUTPUT` may select an output directory; the default is the operating
system temporary directory's `backpackkidz-contrast-audit` folder. The tool
writes full reports, full-page screenshots and readable section screenshots.
The nested audit dependencies do not change the site's production dependency
manifest or lockfile.

Verified with Chromium 153.0.8010.12 and Axe 4.13.0 at 360, 768 and 1440 pixels:

- All authorized targets pass in default state, all eleven card hover states,
  and hover/focus-visible/active states of both affected support links. The
  current-page navigation link also passes default/hover/focus-visible/active
  states, including expanded mobile/tablet menus: 22 states per width,
  66 candidate states in total.
- Corrected elements have no applicable disabled state (static text/anchors).
- Full-document WCAG 2 A/AA and WCAG 2.1 A/AA scans introduce no new serious
  or critical violations, compared with the same baseline interaction states.
- Every element's geometry, attributes and leaf text match the baseline.
- Zero changed pixels fall outside the corrected text rectangles at each
  width, including all four navigation states. Viewport rectangles are
  compared after keyboard scrolling/menu expansion, and must match baseline
  exactly. Full-page, section and navigation screenshots were inspected.
- No horizontal overflow. Existing website suite: 19/19 passed; build passed.
- Audit-tool dependency audit: zero vulnerabilities. Production dependency
  audit still reports the separate Nodemailer baseline issue; this CSS
  candidate does not remediate or waive it.

The test server only serves local tracked/static assets. Non-GET traffic and
provider/API requests are blocked; existing decorative-font GETs are allowed.
Forms are not submitted, no SMTP is used, and no production page is tested.

## Explicit residual baseline findings

Full-page contrast counts are **16 → 0** at 360/768 with the menu closed and
**17 → 0** at 1440. Opening the mobile/tablet menu reveals the same seventeenth
target; it passes every tested state after correction. All full-document
contrast checks in the matrix now have zero violations. The earlier pilot
scan scrolled to the partner grid and did not report the desktop header
target; it was corrected only after explicit scope-extension authorization.

Canonical main also has two existing critical `image-alt` violations on the
header/footer brand images. Both remain unchanged in this delta; preserved
PR #7 already adds `alt=""` inside their named links. No image/content edit is
included here. Axe also reports incomplete checks on existing gradient and
other elements; this is not a claim that all website accessibility passes.

PR #7, PR #9 and Jebediah PR #261 remain untouched. This candidate is not
merged and is not authorization for production publication. Reconciliation
and the full combined acceptance matrix remain gated on the separate
Nodemailer runtime verification/remediation. Automatic non-production Netlify
Deploy Previews are now authorized validation artifacts; this grants no
production publication authority.
