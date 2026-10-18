// Project paths, resolved from this file so tools work regardless of cwd.
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SITE = path.join(ROOT, "site");            // served website (deployable as-is)
export const UPSTREAM = path.join(ROOT, "upstream");    // raw snapshot of ximitech.vn used for rebuilds
export const RESEARCH = path.join(ROOT, "research");    // evidence: crawl, screenshots, diffs, REA
export const DOCS = path.join(ROOT, "docs");
export const TOOLS = path.join(ROOT, "tools");

/** Join a path to the project root. */
export const at = (...parts) => path.join(ROOT, ...parts);
