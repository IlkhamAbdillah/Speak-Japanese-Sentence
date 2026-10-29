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
