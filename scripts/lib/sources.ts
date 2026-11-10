/** The pinned upstream sources: sources/<id>/source.json says where each one comes from and its checksum. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CACHE_DIR, SOURCES_DIR } from "./paths.ts";

export const SOURCE_IDS = ["cc-cedict", "cvdict", "unihan", "makemeahanzi", "hsk", "thieu-chuu"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export const SourceManifest = z.object({
  id: z.enum(SOURCE_IDS),
  name: z.string(),
  homepage: z.url(),
  gives: z.string(),
  url: z.url(),
  version: z.string(),
  retrieved: z.iso.date(),
  /** Set when upstream has no versioned URL, so the file itself is kept in git next to source.json. */
  inRepo: z.string().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  license: z.object({ id: z.string(), url: z.url(), file: z.string() }),
  credit: z.string(),
  notes: z.string().optional(),
});
export type SourceManifest = z.infer<typeof SourceManifest>;

export function manifestPath(id: SourceId): string {
  return path.join(SOURCES_DIR, id, "source.json");
}

export function readManifest(id: SourceId): SourceManifest {
  return SourceManifest.parse(JSON.parse(readFileSync(manifestPath(id), "utf8")));
}

/** Where the source file lives on disk: in the repo, or in the git-ignored download cache. */
export function sourceFile(m: SourceManifest): string {
  if (m.inRepo) return path.join(SOURCES_DIR, m.id, m.inRepo);
  return path.join(CACHE_DIR, m.id, path.basename(new URL(m.url).pathname));
}

export function sha256(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** The source's bytes, checked against the pinned checksum. */
export function readSource(id: SourceId): Buffer {
  const m = readManifest(id);
  const file = sourceFile(m);
  if (!existsSync(file)) throw new Error(`${id}: ${path.relative(process.cwd(), file)} is missing. Run: npm run fetch-sources`);
  const buf = readFileSync(file);
  const got = sha256(buf);
  if (got !== m.sha256) throw new Error(`${id}: checksum ${got} does not match the pinned ${m.sha256}`);
  return buf;
}
