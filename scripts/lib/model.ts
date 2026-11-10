/**
 * The records the build writes (dist/entries.jsonl, dist/chars.jsonl) and the correction files.
 * Every value says where it came from (`src`); `corrected` lists the fields a correction changed.
 * schema/*.json is generated from these (npm run schema).
 */
import { z } from "zod";

export const Src = z.enum(["cc-cedict", "cvdict", "unihan", "makemeahanzi", "hsk", "thieu-chuu", "correction"]);
export type Src = z.infer<typeof Src>;

/** One Hán Việt syllable: lowercase Vietnamese letters, NFC. */
export const HANVIET_SYLLABLE = /^[a-zđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]{1,8}$/u;

export const HanvietReading = z.string().regex(HANVIET_SYLLABLE).refine((s) => s === s.normalize("NFC"), "not NFC");

export const WordRef = z.object({
  simp: z.string(),
  trad: z.string(),
  pinyin: z.string().nullable(),
  pinyinNum: z.string().nullable(),
});

export const EntryHanviet = z.object({
  /** The character at this position of the simplified form. */
  char: z.string(),
  /** Its traditional form, when different. */
  trad: z.string().optional(),
  readings: z.array(HanvietReading),
  src: Src,
  /** When the readings were taken from another form of the character (e.g. 說 for 说), that form. */
  via: z.string().optional(),
});

export const Entry = z.object({
  /** simp|trad|pinyin with tone numbers: the key CC-CEDICT and CVDICT share. */
  id: z.string(),
  simp: z.string(),
  trad: z.string(),
  /** Tone marks, one space between syllables: "jué de". */
  pinyin: z.string(),
  /** CC-CEDICT's own pinyin: "jue2 de5". */
  pinyinNum: z.string(),
  /** One item per Han character of the simplified form, in order. */
  hanviet: z.array(EntryHanviet),
  vi: z.object({ senses: z.array(z.string()), src: Src }).nullable(),
  en: z.object({ senses: z.array(z.string()), src: Src }),
  classifiers: z.object({ items: z.array(WordRef), src: Src }).optional(),
  /** Other words the senses point to ("variant of …", "see …"). */
  refs: z.object({ items: z.array(WordRef), src: Src }).optional(),
  /** HSK 2.0 level (1-6) and HSK 3.0 level (1-6, 7 = levels 7-9). */
  hsk: z.object({ hsk2: z.number().int().min(1).max(6).optional(), hsk3: z.number().int().min(1).max(7).optional(), src: Src }).optional(),
  /** Paths of the fields a correction changed, e.g. "hanviet.0.readings". */
  corrected: z.array(z.string()).optional(),
});
export type Entry = z.infer<typeof Entry>;

const Part = z.object({ char: z.string(), hanviet: z.array(HanvietReading) });

export const Char = z.object({
  char: z.string(),
  hanviet: z.object({ readings: z.array(HanvietReading), src: Src, via: z.string().optional() }).nullable(),
  pinyin: z.object({ readings: z.array(z.string()), src: Src }).optional(),
  en: z.object({ text: z.string(), src: Src }).optional(),
  strokes: z.object({ count: z.number().int().positive(), src: Src }).optional(),
  radical: z.object({ char: z.string(), src: Src }).optional(),
  /** Ideographic Description Sequence, e.g. "⿰讠兑". */
  decomposition: z.object({ ids: z.string(), src: Src }).optional(),
  etymology: z
    .object({
      type: z.enum(["ideographic", "pictographic", "pictophonetic"]),
      hint: z.string().optional(),
      /** The meaning part, with its Hán Việt readings. */
      semantic: Part.optional(),
      /** The sound part, with its Hán Việt readings. */
      phonetic: Part.optional(),
      src: Src,
    })
    .optional(),
  simplified: z.object({ chars: z.array(z.string()), src: Src }).optional(),
  traditional: z.object({ chars: z.array(z.string()), src: Src }).optional(),
  corrected: z.array(z.string()).optional(),
});
export type Char = z.infer<typeof Char>;

const StrList = z.array(z.string().min(1)).min(1);

export const Correction = z
  .object({
    /** A character (all its words), or one entry (one pronunciation of a word). */
    target: z.union([z.object({ char: z.string().regex(/^\p{Script=Han}$/u, "one Han character") }).strict(), z.object({ entry: z.string() }).strict()]),
    /** Char: hanviet.readings. Entry: hanviet.<i>.readings, vi.senses, en.senses. */
    field: z.string().regex(/^(hanviet\.readings|hanviet\.\d+\.readings|vi\.senses|en\.senses)$/),
    set: StrList.optional(),
    add: StrList.optional(),
    remove: StrList.optional(),
    reason: z.string().min(1),
    evidence: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    by: z.string().min(1),
    issue: z.number().int().positive().optional(),
    date: z.iso.date(),
  })
  .strict()
  .refine((c) => [c.set, c.add, c.remove].filter(Boolean).length === 1, "exactly one of set, add, remove")
  .refine((c) => ("char" in c.target) === c.field.startsWith("hanviet.readings"), "a char target takes hanviet.readings; an entry target takes hanviet.<i>.readings, vi.senses or en.senses");
export type Correction = z.infer<typeof Correction>;

export const Meta = z.object({
  name: z.literal("OpenCidian"),
  version: z.string(),
  builtAt: z.iso.datetime(),
  commit: z.string().nullable(),
  license: z.object({ id: z.literal("CC-BY-SA-4.0"), url: z.url(), attribution: z.string() }),
  sources: z.array(z.object({ id: z.string(), name: z.string(), version: z.string(), sha256: z.string(), license: z.string(), url: z.url(), credit: z.string() })),
  counts: z.object({ entries: z.number(), chars: z.number(), corrections: z.number() }),
});
export type Meta = z.infer<typeof Meta>;
