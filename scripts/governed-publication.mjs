#!/usr/bin/env node

import { resolve } from "node:path";
import {
  SLOT_DEFINITIONS,
  allowedCommands,
  assertAllowedCommand,
  createProposal,
  createRollbackProposal,
  fetchPublicSlotResponse,
  formatPreview,
  getGitIdentity,
  loadJson,
  materializeProposal,
  previewProposal,
  proposalDigest,
  readSlot,
  readSlotFromSource,
  validateProposal,
  verifyReceiptInRoot,
} from "./publication-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const [command, ...tokens] = process.argv.slice(2);

const usage = () => {
  process.stdout.write(`Governed website publication candidate tool

Commands:
  read --slot <allowlisted-slot>
  propose --id <proposal-id> --slot <allowlisted-slot> --value <plain-text> [--rationale <text>]
  validate --proposal <proposal.json>
  preview --proposal <proposal.json>
  materialize --proposal <proposal.json>
  verify --receipt <receipt.json>
  verify-live --proposal <proposal.json> --url <https://site-or-preview>
  rollback-preview --receipt <receipt.json> --id <new-proposal-id>

Allowlisted slots:
${Object.entries(SLOT_DEFINITIONS)
  .map(([slot, definition]) => `  ${slot} (${definition.file})`)
  .join("\n")}

There is intentionally no publish, deploy, merge, endpoint, or arbitrary-file command.
`);
};

const parseOptions = (args) => {
  const options = {};

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];

    if (!name?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Malformed option near "${name || "<end>"}".`);
    }

    if (options[name.slice(2)] !== undefined) {
      throw new Error(`Duplicate option "${name}".`);
    }

    options[name.slice(2)] = value;
  }

  return options;
};

const requireExactOptions = (options, required, optional = []) => {
  const allowed = new Set([...required, ...optional]);

  for (const name of Object.keys(options)) {
    if (!allowed.has(name)) {
      throw new Error(`Unsupported option "--${name}".`);
    }
  }

  for (const name of required) {
    if (options[name] === undefined) {
      throw new Error(`Missing required option "--${name}".`);
    }
  }
};

const printJson = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

const main = async () => {
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  assertAllowedCommand(command);
  const options = parseOptions(tokens);

  switch (command) {
    case "read": {
      requireExactOptions(options, ["slot"]);
      printJson({ repository: "BackPackKidz/backpackkidz", base: getGitIdentity(root), ...readSlot(root, options.slot) });
      break;
    }
    case "propose": {
      requireExactOptions(options, ["id", "slot", "value"], ["rationale"]);
      const proposal = createProposal({
        proposalId: options.id,
        base: getGitIdentity(root),
        slot: options.slot,
        value: options.value,
        rationale: options.rationale,
      });
      printJson(proposal);
      process.stderr.write(`Proposal identity: ${proposalDigest(proposal)}\n`);
      break;
    }
    case "validate": {
      requireExactOptions(options, ["proposal"]);
      const proposal = validateProposal(loadJson(resolve(options.proposal)));
      printJson({ valid: true, proposalId: proposal.proposalId, proposalDigest: proposalDigest(proposal) });
      break;
    }
    case "preview": {
      requireExactOptions(options, ["proposal"]);
      process.stdout.write(`${formatPreview(previewProposal(root, loadJson(resolve(options.proposal))))}\n`);
      break;
    }
    case "materialize": {
      requireExactOptions(options, ["proposal"]);
      const result = materializeProposal(root, loadJson(resolve(options.proposal)));
      process.stdout.write(`${formatPreview(result.preview)}\n\n`);
      printJson({
        status: "candidate-materialized",
        branch: result.branch,
        receipt: result.receiptPath,
        publicationAuthority: result.receipt.publicationAuthority,
      });
      break;
    }
    case "verify": {
      requireExactOptions(options, ["receipt"]);
      printJson(verifyReceiptInRoot(root, loadJson(resolve(options.receipt))));
      break;
    }
    case "verify-live": {
      requireExactOptions(options, ["proposal", "url"]);
      const proposal = validateProposal(loadJson(resolve(options.proposal)));
      const { response, url } = await fetchPublicSlotResponse(options.url, proposal.operation.slot);

      if (!response.ok) {
        throw new Error(`Live verification request failed with HTTP ${response.status}.`);
      }

      const actual = readSlotFromSource(await response.text(), proposal.operation.slot);

      if (actual !== proposal.operation.value) {
        throw new Error(`Live verification failed for ${proposal.operation.slot}.`);
      }

      printJson({
        status: "passed",
        proposalId: proposal.proposalId,
        proposalDigest: proposalDigest(proposal),
        url,
        verifiedAt: new Date().toISOString(),
      });
      break;
    }
    case "rollback-preview": {
      requireExactOptions(options, ["receipt", "id"]);
      const receipt = loadJson(resolve(options.receipt));
      const current = readSlot(root, receipt.operation?.slot);

      if (current.sourceSha256 !== receipt.result?.fileSha256 || current.value !== receipt.operation?.value) {
        throw new Error("Rollback fails closed because current content no longer matches the recorded result.");
      }

      const proposal = createRollbackProposal({
        root,
        receipt,
        base: getGitIdentity(root),
        proposalId: options.id,
      });
      printJson(proposal);
      process.stderr.write(`Rollback proposal identity: ${proposalDigest(proposal)}\n`);
      break;
    }
    default:
      throw new Error(`Unreachable command: ${command}`);
  }
};

main().catch((error) => {
  process.stderr.write(`ERROR: ${error.message}\n`);
  process.stderr.write(`Allowed commands: ${allowedCommands.join(", ")}\n`);
  process.exitCode = 1;
});
