# Grammar list data

`n5.txt` … `n1.txt` are the grammar points of the **Grammar** page, and
`particles.txt` its particle list (kept apart from the grammar, user-requested; the
basic N5 particle points were moved there from `n5.txt`),
(`src/pages/GrammarPage.tsx`), one file per JLPT level, parsed at load time by
`src/services/grammar.ts` (imported with `?raw`, so editing a file is enough).

- Written for this app (2026-11): the patterns are standard JLPT grammar, the
  meanings (en, id) and every example sentence were written for the app, not
  copied from a textbook or website. Don't paste textbook material in here (the
  repo is public).
- Levels follow the usual JLPT study lists. The JLPT has published no official
  grammar list since 2010, so some points sit a level higher or lower elsewhere.
- Order inside a file = the order of the list (roughly the order a course meets
  them). The id of a point is its level + position (`N4-12`), so inserting a
  point renumbers the ones after it; nothing is saved by id. The practice
  progress is saved by level + pattern, so changing a pattern's text resets its
  progress.

## Format

```
@ 〜が好き / 〜が嫌い | がすき / がきらい
= like / dislike | suka / tidak suka
f N + が + 好き・嫌い
s like
e 私は音楽[が好き]です。 | I like music. | Saya suka musik.
e 弟は野菜[が嫌い]です。 | My younger brother dislikes vegetables. | Adik laki-laki saya tidak suka sayur.
```

- `@ pattern | reading`: the pattern as listed; a note in parentheses with Latin
  letters (`〜ために (reason)`) is dropped where the pattern is used as a quiz
  choice. The reading (kana) is only given when the pattern has kanji; it is
  used for searching (also as romaji).
- `= english | indonesian`: the meaning. Senses are separated by `,` or `;`: the
  quiz never offers two points that share an English sense as options of the
  same question.
- `f`: how the pattern attaches. Abbreviations (explained in the page's ⓘ
  dialog): N noun, A い-adjective (A−い = without い), Na な-adjective, V-dict,
  V-masu stem, V-て, V-ta, V-nai (V-nai stem = 行か), V-ba, V-vol (volitional),
  V-pot / V-pass / V-caus, plain form.
- `s group, group` (optional): points that are easy to confuse, e.g. ましょう /
  ませんか / ましょうか, or について / に関して. Points of one level sharing a
  group are never offered as each other's wrong options (the quiz takes wrong
  options from the same level only, so groups only matter within a file).
- `e sentence | english | indonesian`: an example (at least two). The part in
  `[ ]` is the grammar point: highlighted on the card, the blank in the quiz. A
  pattern in two pieces gets two brackets (`私[は]学生[です]`); the quiz choice is
  then `は…です`.
- `#` starts a comment line.

## Particles (`particles.txt`)

Same format, one entry per use of a particle (`に (time)`, `に (destination)`…). The
particle is the first word of the pattern; the list shows one section per particle
in file order. Extra:

- `l N4`: the JLPT level of the use (default N5).
- `[へ|に]` in an example: every particle that is right there, the first one shown.
  The particle practice accepts any of them, and the AI is asked to mark its own
  sentences the same way. Only particles on the practice keypad (`PARTICLE_KEYS`
  in `services/particles.ts`) can be blanks.
