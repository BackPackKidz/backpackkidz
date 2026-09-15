# Nodemailer supported security remediation

This source-only branch pins Nodemailer 10.0.10 after read-only runtime
verification and offline compatibility testing. The production implementation
change is limited to the dependency declaration and its lockfile entry.
Production remains on 9.0.6 until separately authorized canonical publication.

Baseline main: `8029a0a6b1708f74f95223e237459f8de48ad009`.
Baseline tree: `d6dbd54671f016a83c8be46cd121d675d1c16dda`.
The baseline manifest range is `^9.0.6`; its lockfile and clean-installed package
were exactly **9.0.6**. A fresh baseline audit on 2026-09-14 reported
one vulnerable direct package, high aggregate severity, with four advisories:

| Upstream advisory | Severity | Affected version range | First fixed version |
| --- | --- | --- | --- |
| [GHSA-8m3c-c648-2xjj](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8m3c-c648-2xjj) — legacy content resolver bypass | Moderate | <=9.1.0 | 9.1.1 |
| [GHSA-wmmp-3585-3rmp](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-wmmp-3585-3rmp) — IDN recipient interpretation | Moderate | <9.1.0 | 9.1.0 |
| [GHSA-2x7j-588g-ccc2](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-2x7j-588g-ccc2) — quadratic address parsing | High | <9.1.0 | 9.1.0 |
| [GHSA-cc9r-2j5m-2m83](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-cc9r-2j5m-2m83) — recipient comment parsing | Moderate | >=6.9.16 <9.1.0 | 9.1.0 |

[Upstream support policy](https://github.com/nodemailer/nodemailer/blob/master/SECURITY.md)
supports only the latest major, currently 10.x. The
[current changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md)
and npm metadata identify **10.0.10**, released September 14, as the current
supported patched release, rechecked immediately before this upgrade. It is
pinned exactly in both manifest and lockfile. The 9.1.x audit minimum is
unsupported. No other dependency resolution changed. The corrected production
dependency audit returns zero vulnerabilities, resolving all four entries.

## Runtime evidence obtained before the major bump

[Published production deploy](https://app.netlify.com/projects/backpackkidz/deploys/6a91fdd31f6a59000815e7d1)
is for canonical main `8029a0a6b1708f74f95223e237459f8de48ad009`.
Its public initializing log records `Now using node v22.23.2 (npm v10.9.8)`;
the build packages eleven Functions. Authenticated inspection confirmed that
this is still the published production deploy and eleven production Functions
remain listed with their August 28 creation date.

[Nodemailer 10 requires Node >=20](https://nodemailer.com/), with ESM and
CommonJS entry points. Node 22.23.2 meets that minimum.
[Netlify's Functions configuration documentation](https://docs.netlify.com/build/functions/configuration/)
selects a supported build Node major unless `AWS_LAMBDA_JS_RUNTIME` overrides
it. In the authenticated [environment-variable UI](https://app.netlify.com/projects/backpackkidz/configuration/env),
the unfiltered all-scopes/all-contexts list contained ten keys, none this
override. Searching its exact name returned no matching variables. No unrelated
values were opened. Override presence is **NO**, value **not configured**.

Applying the documented default to build Node 22.23.2 yields **nodejs22.x**.
[AWS lists Node 22](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
as supported until April 30, 2027, outside Netlify's two-month cutoff. This is
runtime selection verified through authenticated configuration and the provider
contract, as explicitly authorized; it is not an observed invocation's patch
version. No function was invoked and no provider setting was changed.

## Preserved notification contract and offline tests

`netlify/email-utils.mjs` remains byte-identical to baseline. It uses an ESM
default import and `createTransport().sendMail()`. Notifications select fixed
recipients by record type or the existing configured environment overrides;
visitor input supplies reply-to and text fields, not envelope destinations.
The sender projects only `from`, `to`, `replyTo`, `subject`, `text`. No raw,
HTML, attachment, path or URL message authority is introduced. Record fields
with such names are rendered as literal text, never forwarded as mail options.
Existing SMTP host/port/secure/auth selection and fail-soft behavior remain.

Seventeen additional tests establish the current behavior before changing the
dependency: ESM/CommonJS transport construction, all five fixed and configured
recipient paths, actual text-only MIME compilation using stream transport,
field projection, 465/587 transport options, each missing credential, and
constructor/send failure paths. Network entry points are blocked, credentials
are synthetic and restored, and no real SMTP or provider call occurs.

The unchanged seventeen preflight tests also pass against 10.0.10 on local
Node **22.23.2**, matching the published build version and selected runtime
major. All **36** email/form/website tests pass. Clean install used `npm ci
--ignore-scripts`; the package set has no required installation lifecycle step.
Build, all eleven Function syntax/import checks with network entry points
blocked, and `npm audit --omit=dev` pass. No real SMTP or authentic email was
used. The Node executable came from nodejs.org and its SHA-256 matched the
official release checksum. SMTP production delivery is deliberately untested.

Independent review must reference the final exact HEAD/TREE. After both source
remedies are clean, validate a separate local reconciliation candidate with
the accessibility change and the exact PR #7/#9 deltas, preserving those PR
refs and partner-logo semantics. Automatic non-production Draft PR Deploy
Previews are authorized validation artifacts. Merges, provider changes,
production publication and real pilot activation require separate authority.
