import { resolve } from "node:path";
import { validateLogoCandidate } from "./partner-logo-contract.mjs";
const result = validateLogoCandidate(resolve(import.meta.dirname, ".."), { base: process.env.PILOT_BASE, head: process.env.PILOT_HEAD, preview: true });
console.log(JSON.stringify(result ?? { status: "not_a_logo_candidate" }));
