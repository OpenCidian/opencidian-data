/** npm run schema: write schema/*.json from the zod models in scripts/lib/model.ts. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Char, Correction, Entry, Meta } from "./lib/model.ts";
import { SCHEMA_DIR } from "./lib/paths.ts";

for (const [name, schema] of [["entry", Entry], ["char", Char], ["correction", Correction], ["meta", Meta]] as const) {
  const json = { $id: `https://github.com/OpenCidian/opencidian-data/schema/${name}.json`, ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) };
  writeFileSync(path.join(SCHEMA_DIR, `${name}.json`), JSON.stringify(json, null, 2) + "\n");
  console.log(`schema/${name}.json`);
}
