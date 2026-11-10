import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SOURCES_DIR = path.join(ROOT, "sources");
export const CACHE_DIR = path.join(ROOT, ".cache", "sources");
export const CORRECTIONS_DIR = path.join(ROOT, "corrections");
export const DIST_DIR = path.join(ROOT, "dist");
export const SCHEMA_DIR = path.join(ROOT, "schema");
