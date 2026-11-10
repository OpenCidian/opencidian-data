# opencidian-data

The data behind OpenCidian by Perxel: an open Chinese ↔ Vietnamese dictionary (Hán Việt, pinyin, character breakdown) that people, apps and AI models can read. This repo holds the pinned upstream sources, the community corrections, and the build that turns them into one dataset. Every value in it says where it came from.

The name: 词典 *cídiǎn* and 詞典 *từ điển* are the same word, read in Mandarin and in Hán Việt.

## What a word looks like

```jsonc
{
  "id": "觉得|覺得|jue2 de5",            // simp|trad|pinyin: the key CC-CEDICT and CVDICT share
  "simp": "觉得", "trad": "覺得", "pinyin": "jué de", "pinyinNum": "jue2 de5",
  "hanviet": [                           // one per character, so compounds get every reading
    { "char": "觉", "trad": "覺", "readings": ["giác", "giáo"], "src": "thieu-chuu", "via": "覺" },
    { "char": "得", "readings": ["đắc"], "src": "thieu-chuu" }
  ],
  "vi": { "senses": ["nghĩ rằng ...; cảm thấy rằng ...", "cảm thấy (không thoải mái, v.v.)"], "src": "cvdict" },
  "en": { "senses": ["to think that ...; to feel that ...", "to feel (uncomfortable etc)"], "src": "cc-cedict" },
  "hsk": { "hsk2": 2, "hsk3": 1, "src": "hsk" }
}
```

Characters have their own record (`dist/chars.jsonl`): Hán Việt readings, pinyin, radical, stroke count, breakdown (IDS), and the meaning and sound parts, each with its own Hán Việt reading. `classifiers` and `refs` (the words a sense points to) are structured fields, not text in the meaning. A field changed by a correction has `"src": "correction"` and is listed in `corrected`. The full schema is in [`schema/`](schema/).

## Sources

| Source | Gives | Licence |
|---|---|---|
| [CC-CEDICT](https://cc-cedict.org/wiki/) | words, pinyin, English, classifiers | CC BY-SA 4.0 |
| [CVDICT](https://github.com/ph0ngp/CVDICT) | Vietnamese meanings | CC BY-SA 4.0 |
| Thiều Chửu, *Hán Việt tự điển*, via [catusf/tudien](https://github.com/catusf/tudien) | Hán Việt readings (first choice) | CC0 |
| [Unihan](https://www.unicode.org/charts/unihan.html) (Unicode 18.0) | Hán Việt where Thiều Chửu has none, strokes, variants | Unicode licence |
| [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) (`dictionary.txt`) | breakdown, radical, meaning and sound parts | LGPL-3.0 |
| [Complete HSK Vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | HSK 2.0 and 3.0 levels | MIT |

Each one is pinned in `sources/<id>/source.json` (URL at a fixed commit or version, SHA-256, licence, credit). CC-CEDICT has no versioned download, so its file is kept in git.

A character's Hán Việt comes from Thiều Chửu first. Unihan's `kVietnamese` is used only where Thiều Chửu has nothing, because it often gives a Nôm reading (细 *tới*, 搬 *bưng*) rather than the Hán Việt one (*tế*, *bàn*). When a simplified character has no entry of its own, the reading comes from its traditional form or a variant, and `via` names that form.

## Licence

The dataset is **CC BY-SA 4.0** ([`LICENSE-DATA`](LICENSE-DATA)), share-alike from CC-CEDICT and CVDICT. Credit "OpenCidian by Perxel" and the sources above; `dist/meta.json` carries the full attribution line. The code is MIT ([`LICENSE`](LICENSE)).

## Corrections

Anyone can suggest a fix with the [Correction form](../../issues/new?template=correction.yml). A maintainer checks it and turns it into a file in `corrections/`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Build

```sh
npm ci
npm run fetch-sources   # download the pinned sources into .cache/ and check their checksums
npm run build           # → dist/entries.jsonl, dist/chars.jsonl, dist/meta.json, dist/report.json
npm run validate        # schema, corrections (targets, conflicts, no-ops), well-formed values
npm test
npm run release         # gzip dist/ into dist/release/ with SHA256SUMS
npm run schema          # regenerate schema/*.json from scripts/lib/model.ts
npm run compare:hch -- <path to hieu-chu-han/public/data/dictionary.json>
```

On every merge to `main` that touches the data, CI builds, validates and publishes the dataset as a GitHub release (`data-<date>-<commit>`).

## Layout

```
sources/<id>/            source.json (pin, checksum, licence, credit) + licence text
corrections/hanviet/     one YAML file per correction
scripts/                 fetch-sources, build, validate, release, schema, compare-hieu-chu-han
scripts/lib/             parsers (cedict, unihan, makemeahanzi, hsk, thieuchuu), model, build, corrections
schema/                  JSON Schema (generated)
test/                    unit tests, a build test, and a sample of hieu-chu-han's data
```

OpenCidian by [Perxel](https://perxel.com). The API (`opencidian-api`) and the public MCP server (`opencidian-mcp`) read this dataset.
