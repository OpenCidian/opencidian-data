# OpenCidian v0 vs hieu-chu-han's dictionary.json

Plan 001 step 2: the same words, the same pinyin, Vietnamese the same or better, with every difference explained.
Run on 2026-11-10 against hieu-chu-han `e1c59d6` (`public/data/dictionary.json`, 119,210 words) with `npm run compare:hch`.
`test/build.test.ts` repeats the check on a 3,142-word sample (`test/fixtures/hieu-chu-han-sample.json`: every HSK 1 word plus every 100th word) and fails on any difference with no explanation.

## Words and Vietnamese meaning

| Kind | Words | Why |
|---|---:|---|
| same | 93,792 | Same pinyin, same Vietnamese senses. |
| vi-same-after-cleanup | 15,525 | Same senses once hieu-chu-han's raw CEDICT markers (`覺\|觉[jue2]`, `LT:…`) are rendered as OpenCidian renders them (`觉 (jué)`, classifiers moved to `classifiers`). |
| word-not-in-cedict | 4,582 | In chinese-lexicon (an older CC-CEDICT plus its own additions) but not in the pinned CC-CEDICT. |
| pinyin-differs | 2,884 | chinese-lexicon writes the pinyin differently (older reading, or letters as one syllable: `usbji4…` vs `U S B ji4…`). |
| vi-theirs-other-line | 2,426 | hieu-chu-han's `cvdict.json` keeps one CVDICT line per simplified form, so the word shows another pronunciation's meaning. OpenCidian matches `simp\|trad\|pinyin`. **OpenCidian is right here.** |
| vi-cvdict-duplicate-key | 1 | CVDICT has 沙坪坝区 twice; OpenCidian keeps both lines' senses. |
| unexplained | 0 | |

hieu-chu-han's copy of `CVDICT.u8` has the same SHA-256 as the pinned one, so no difference comes from a CVDICT version.

## Hán Việt (first character only: hieu-chu-han has nothing for the others)

| Kind | Words | Why |
|---|---:|---|
| hv-same | 73,579 | hieu-chu-han's reading is one of OpenCidian's. |
| hv-ours-only | 21,249 | hieu-chu-han has none (Unihan lacks the character); OpenCidian has one from Thiều Chửu or a traditional/variant form. |
| hv-thieu-chuu-over-unihan | 13,060 | hieu-chu-han shows Unihan `kVietnamese`, often a Nôm reading (细 *tới*, 搬 *bưng*); OpenCidian takes Thiều Chửu first (*tế*, *bàn*). |
| hv-both-empty | 3,855 | In neither Thiều Chửu nor Unihan. |
| hv-unihan-revised | 1 | 艿: hieu-chu-han's older kVietnamese copy says *nẩy*, Unicode 18 says *nảy*. |
| hv-theirs-only / unexplained | 0 | |

## Coverage of the build (2026-11-10)

- 125,397 entries, 14,534 characters.
- Vietnamese meaning: 94.4% of entries (CVDICT matched exactly, then by case/spacing, then by simplified form + pinyin when CC-CEDICT changed the traditional form).
- Hán Việt for every character of the word: 95.2% of entries (60.7% with Unihan alone, before Thiều Chửu was added).
- Characters of HSK words still without Hán Việt: 爸 (HSK 1), 啤 (3), 弯既梯 (4), 挡 (5), 17 at HSK 6 and 36 at HSK 7–9. Listed in `dist/report.json` → `hanvietMissingHsk`; they need correction files.
