# Kanji curriculum data

The JLPT Kanji section picks its target kanji from these lists; the AI only
writes a word for each chosen kanji (see `src/services/kanjiCurriculum.ts`).

## `jlpt.json`

The kanji of each JLPT level (N5–N1), each kanji listed once, at the level
where it is introduced. Within a level they are ordered by how common they
are, most common first; new kanji are taught in that order.

- Levels: Jonathan Waller's JLPT lists (http://www.tanos.co.uk/jlpt/), CC BY.
- Order: KANJIDIC newspaper frequency (EDRDG, CC BY-SA 4.0,
  http://www.edrdg.org/wiki/index.php/KANJIDIC_Project), taken from
  https://github.com/davidluzgouveia/kanji-data.

The JLPT has no official kanji list; these are the commonly used unofficial
ones.

## `sou-matome-n4.json`

Your own N4 curriculum from *Nihongo Sou Matome N4*. While `units` is empty,
N4 uses the N4 list from `jlpt.json`. Once it has kanji, it replaces that list
and new kanji are taught unit by unit, in the order written here.

```json
{
  "level": "N4",
  "source": "Nihongo Sou Matome N4",
  "units": [
    { "unit": "1-1", "kanji": "家族親" },
    { "unit": "1-2", "kanji": "…" }
  ]
}
```

`kanji` is a string of kanji characters (spaces and commas are ignored). Only
list the kanji themselves: the book's vocabulary lists are copyrighted and
this repository is on GitHub.

## `details.json`

English meanings (up to 5), on'yomi (up to 4, hiragana) and
kun'yomi (all of them; the card shows 6, the rest still help match example words; okurigana after `.`, `-` marks a prefix/suffix reading) of
every kanji in `jlpt.json`, shown on the **Kanji** page
(`src/pages/KanjiPage.tsx`, `src/services/kanjiList.ts`).

- From KANJIDIC (EDRDG, CC BY-SA 4.0,
  http://www.edrdg.org/wiki/index.php/KANJIDIC_Project), via the `kanji.json`
  of https://github.com/davidluzgouveia/kanji-data (only the KANJIDIC fields;
  the WaniKani fields were left out). Generated on 2026-10-31.
- `p` lists each kanji's parts (elements), from KRADFILE (EDRDG, CC BY-SA 4.0,
  https://www.edrdg.org/krad/kradinf.html, `kradfile` in
  http://ftp.edrdg.org/pub/Nihongo/kradzip.zip, EUC-JP), used by the Kanji
  page's Radical filter: a kanji counts under every part (聞 = 耳 + 門), not
  only its one dictionary radical (user-requested). Each character of `p` is
  an id in `parts`, in RADKFILE order with its stroke count `s`. KRADFILE uses
  stand-in kanji for parts JIS X 0208 lacks (化 = 亻, 汁 = 氵, 艾 = 艹, 邦 = 阝
  on the right, 阡 = 阝 on the left…, listed in its `kradintro`); `g` is the
  real glyph for those (｜ ノ ハ → 丨 丿 八 too). `n` is an English name: the
  Unicode Kangxi radical name, else the part's first KANJIDIC meaning, else
  written by hand (stand-ins, マ/ユ/ヨ shapes). Generated on 2026-11-01.
  Regenerating the meanings/readings must keep `p` and `parts`.
- `c` lists each kanji's larger parts: the `kvg:element`s of its KanjiVG
  drawing (Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net,
  `kanjivg-20260714.xml.gz`) at any depth that aren't a KRADFILE part glyph
  and are in at least two of the list's kanji (待 → 寺, 格 → 各). They are in
  `components` with the KANJIDIC meanings `m` and readings `r` of the part as a
  kanji. A kanji counts under its `p` parts, its `c` parts and itself.
- Search keys of `parts`: `m` / `r` are the KANJIDIC meanings / readings of the
  part as a kanji (when it is one), `j` Japanese part names (さんずい,
  にんべん, くさかんむり…) written for the app for about 100 common parts.
  Generated on 2026-11-01.
- Meanings are English only (KANJIDIC has no Indonesian).
