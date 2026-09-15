# Governed partner-logo source capability

**Status:** Source candidate; disabled; independent review and merge pending.

This implements the website portion of Accepted Jebediah ADR 0036. It is based
on preserved PR #7 HEAD `be1bceba3d7b37ce0defbe8de27507ff997a0273`, TREE
`bb488f5d11b1e76d29a5cc4b754d08de779a1e3d`. Neither PR #7 nor this source
candidate is merged by implementation authority. The source PR is stacked on
`bonsai/governed-publication-lane`; the workflow also checks this exact base
branch so its source tests run before foundation canonicalization.

## Fixed operation and authority

`set_partner_logo` maps `nicolas` and `studio-seven` to their existing
`communityPartners` records. The registry preserves both existing names and
URLs. It permits only image, alt, width, height and a closed layout value, one
canonical PNG per accepted partner, directly obsolete logo TODO text, and the
required publication receipt. Acorn parses the literal array; only accepted
object-property ranges are edited. Dynamic JavaScript evaluation, arbitrary
records, markup, paths, URLs, Git refs and shell commands are unavailable.

The trusted execution keys are read from `publication/partner-logo-keys.json`
in the immutable canonical base. Its empty key list deliberately prevents any
real materialization. Future reviewed configuration supplies public Ed25519
keys, purpose, ID and validity window; no private key belongs in this repository.
A key introduced only in the candidate cannot authorize that candidate.

Interaction owns each explicit item decision, the separate bundle decision and
the bounded execution grant. The website verifies both the signed grant and
the separately signed materialization acknowledgment. A receipt binds base
HEAD/TREE, exact items, image hashes, manifest, decisions, grant and completion
time. First materialization must occur within the fresh grant. Reconciliation
accepts only identical files and receipts. Historical CI verifies signatures
at their recorded materialization time; it does not renew execution authority.

## Source interfaces

`scripts/partner-logo.mjs` accepts one closed canonical JSON value on stdin and
one fixed operation: `plan`, `materialize-files`, `attach-receipt`,
`candidate-preview-check`, or `rollback-preview`. It uses its own reviewed
checkout. It does not merge, publish, deploy or accept credentials in arguments.
The Jebediah executor adds the exact reviewed files, creates one fixed branch
and Draft PR through a bounded GitHub adapter, and records a verified artifact.

`candidate-check` continues to enforce the normal publication gate. For a
synthetic item, that required check deliberately fails with
`synthetic_candidate_not_publishable`. The separate
`partner-logo-preview-validation` check verifies the complete synthetic
candidate without making it publishable. No normal-check waiver is introduced.

The source includes a read-only, exact inverse planner. `rollback-preview`
accepts only `bundle_sha256`; it derives the original receipt and commit from
Git ancestry, verifies the original accepted-class candidate, and refuses any
subsequent change to the target files. A human prepares a new inverse PR with
only the derived restore/delete manifest and its new rollback receipt. The
normal candidate verifier recreates and checks every inverse byte. There is no
runtime rollback actuator. A new independent human review and exact-head merge
authorization are required; no actual rollback is authorized or performed here.

## Verification and known release gates

Run `npm ci`, install the locked Playwright Chromium with
`npx playwright install chromium`, then `npm run check`. Tests use generated
pixels and temporary local repositories. No authentic sponsor asset is used.
PNG decoding/normalization is owned by the confined Jebediah decoder. The
website independently validates PNG structure, canonical encoding, dimensions,
hashes, literal registry changes and the complete Git diff/modes.

The deployment browser verifier accepts an immutable Netlify deploy ID, checks
the fixed partners page at widths 360/768/1440, verifies images, URLs, layout,
console/resource failures and Axe WCAG results, and returns screenshot hashes.
Its CLI accepts no arbitrary URL. It blocks publication whenever full-page
accessibility findings remain. The test-only local server overlays synthetic
pixels without changing the site's tracked content.

On 2026-09-14 the local Chromium/Axe run found the same 16 serious
color-contrast targets on the unchanged page and the two-logo overlay at each
width. Image/URL/layout/console/resource checks passed and the overlay added no
accessibility findings. These are **not** full accessibility passes. The
existing page contrast fixes need separate scope authority; unrelated site CSS
has not been changed or waived. `npm audit` also reports an existing high
Nodemailer advisory in the unchanged mail dependency, requiring a separately
scoped dependency disposition. No form or mail behavior changed in this pilot.

The strict-base provider proposal is source only. A release additionally needs
canonical foundation/source/key configuration, current passing checks, exact
preview evidence, a separate authenticated publication decision, independent
human GitHub review, strict main-base enforcement and exact-head human merge
authorization. The recorded merge tree and Netlify production commit must then
match the approved candidate. No source command supplies that authority.
