# Governed public-site publication lane

This directory defines the website side of the BONSaAI publication boundary. It does not connect the Jebediah application to this repository, add a CMS, expose a mutation endpoint, or grant an AI deployment authority.

## Boundary

The only supported operation is `set_public_text`, and its target is an enum rather than a file path. The initial allowlist contains two public, non-payment text slots:

- `home.hero.summary`
- `events.featured.summary`

The contract rejects unknown fields, paths, markup, oversized values, common credential formats, unknown operations, and stale Git base identities. Payment pages, PayPal configuration, Netlify Functions, forms, redirects, assets, and arbitrary files are not addressable.

The local tool can read, propose, validate, preview, materialize a candidate on a clean non-default branch, verify, and prepare a guarded inverse proposal. It intentionally cannot publish, deploy, merge, or write an arbitrary target. Materialization prepares the exact pull-request diff before approval; it is not publication.

## Required authority configuration

Production authority remains GitHub authentication plus repository rules, followed by the existing Netlify deployment from `main`. Before treating this lane as enforceable, an owner must configure a `main` ruleset in GitHub:

1. Require all changes through pull requests.
2. Require at least one approval from an authorized human and dismiss stale approvals when new commits are pushed.
3. Require the `governed-publication-check / governed-publication-check` status check.
4. Block force pushes and branch deletion.
5. Do not grant the Jebediah/BONSaAI automation identity ruleset bypass or direct `main` push permission. Give it only the minimum repository metadata/content and pull-request permissions needed to create a candidate branch and Draft PR.
6. Keep Netlify production deployment restricted to `main`; deploy previews may be used for review.

At the time this lane was authored, GitHub reported no branch protection or repository rulesets on `main`. That owner-side control is therefore a required activation step, not an assumption made by this code.

## Workflow

Read current state:

```text
npm run publication -- read --slot home.hero.summary
```

Create a proposal. Save stdout as a JSON file outside the repository or in the calling system's proposal store; stderr prints its SHA-256 identity:

```text
npm run publication -- propose --id pub-example-summary --slot home.hero.summary --value "Exact approved public copy."
```

Preview the proposal against the exact base:

```text
npm run publication -- preview --proposal C:\path\to\proposal.json
```

On a clean feature branch based on the proposal's exact HEAD/TREE, materialize the candidate:

```text
npm run publication -- materialize --proposal C:\path\to\proposal.json
```

The command changes only the allowlisted slot and writes `publication/audit/<proposal-id>.json`. Commit those exact files, push the feature branch, and open a Draft PR. CI verifies the contract and the preserved site boundaries. An authorized human reviews the human-readable diff and exact proposal digest, marks the PR ready, and approves. GitHub merges only that reviewed candidate. Netlify then follows its existing `main` deployment path.

After a deploy preview or production deploy, verify the exact visible result:

```text
npm run publication -- verify-live --proposal C:\path\to\proposal.json --url https://deploy-preview-7--backpackkidz.netlify.app
```

The live verifier only accepts these Back Pack Kidz deployment identities over HTTPS:

- `backpackkidz.com`
- `www.backpackkidz.com`
- `backpackkidz.netlify.app`
- `deploy-preview-<positive integer>--backpackkidz.netlify.app`

Arbitrary `*.netlify.app` hosts, hostname suffix tricks, URL userinfo, non-default ports, and HTTP are rejected.

## Audit and rollback

The proposal digest, candidate receipt, Git commit/tree, GitHub PR review and merge actor, CI result, and Netlify deployment result together form the audit chain. No secret belongs in any of those records.

Rollback uses the same authority boundary. From the deployed revision, prepare a guarded inverse proposal:

```text
npm run publication -- rollback-preview --receipt publication/audit/pub-example-summary.json --id pub-rollback-example-summary
```

The command fails if current content differs from the receipt. Preview and materialize that inverse proposal on a new branch, then approve and merge it through a new PR. For a whole-candidate rollback, `git revert` of the merge commit through a new PR is also bounded and auditable. Never force-push or directly edit production.
