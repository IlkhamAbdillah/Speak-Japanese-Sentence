# Word list data

`words.json` is the word list used by the **Words** page
(`src/pages/WordsPage.tsx`) and its quiz.

- `onomatopoeia` and `adverb` (adverbs, time expressions, conjunctions) were
  transcribed from the user's PDF `material/pdf-kotoba-onomatope_compress.pdf`
  (git-ignored), originally from https://www.scribd.com/document/485472399/kotoba-onomatope
  (credited in the Words page's ⓘ dialog).
- `adjective` (in `words.json`) are common JLPT N5–N4 adjectives written with
  kanji, chosen for the app (not from a textbook). `adjType` is `i` / `na`.
- Every word in `words.json` also has `jlpt` (missing = Non-JLPT), `frequency`
  and `topic`, worked out the same way as for the verbs below (JLPT lists +
  wordfreq; i-adjectives also count 高く/高かっ/高けれ, onomatopoeia also count
  the katakana spelling, words ending in に/と also count the bare word). Ten
  words wordfreq splits into several tokens got their frequency by hand:
  まあまあ, べつべつ, そのために, そのけっか (common), あちらこちら, よくよく
  (uncommon), じょうじょう, あきあき, ぺちゃぺちゃ, カーカー (rare). Each array
  is ordered by `topic`, related words and opposites next to each other
  (暑い 寒い, にこにこ にやにや, だから それで).
- `verbs.json` is based on the verb list of **Japanese Verb Conjugator**
  (https://www.japaneseverbconjugator.com/JVerbList.asp, downloaded 2026-10-31),
  credited on the Words page. English meanings, romaji and classes come from the
  site; the Indonesian meanings were written for the app. Sorted by reading.
  `verbGroup`: 1 = godan, 2 = ichidan, 3 = irregular. Every verb also has:
  - `jlpt`: the easiest level whose vocabulary list has the verb, from
    open-anki-jlpt-decks (https://github.com/jamsinclair/open-anki-jlpt-decks,
    MIT), which is based on Jonathan Waller's lists (tanos.co.uk, CC BY).
    Missing = on none of the lists ("Non-JLPT"). Matched on word + reading.
  - `frequency` (veryCommon / common / uncommon / rare): from wordfreq 3.1
    (https://github.com/rspeer/wordfreq, data CC BY-SA 4.0), summing the
    dictionary form and the conjugation stems MeCab splits off (食べ, 待っ,
    待た…), as Zipf: ≥5.0 / ≥4.3 / ≥3.3 / below. The kana reading counts too
    when no other verb shares it (only the dictionary form: kana stems collide
    with grammar like なく, てる). 有る, 居る and 呉れる are set to veryCommon by
    hand (written ある, いる, くれる), and 着る, 似る to common (their
    one-kanji stems 着, 似 can't be counted). Approximate, meant for filtering.
  `topic` groups verbs by meaning (movement, money-work, food, talk…), and the
  file is ordered by topic with related verbs and opposites next to each other
  (歩く 走る, 買う 売る, 着る 脱ぐ). Every list is shown by JLPT level (N5 → N1 →
  Non-JLPT) and, within a level, in file order, so related verbs stay together
  (user-requested; `compareWords` in services/vocab.ts). How common and group
  are tags and filters only.
  JLPT matching also handles reading variants (いく; ゆく) and okurigana
  variants (終る / 終わる) by comparing the kanji and the reading.
  Every word has all of these (all-or-nothing, user-requested). The list shows
  them without text tags: a section per JLPT level, a coloured stripe for the
  verb group / い・な, and signal bars for how common (see CLAUDE.md).
  Changes from the site:
  - filled in the kanji and/or kana the site leaves blank (~100 verbs);
  - classes fixed: 来る and する are irregular (3), 隠れる, 臥せる and 駆ける
    are ichidan, 加わる is godan;
  - typos fixed (通おす → 通す, 流がす → 流す, 污す → 汚す, stray spaces and
    commas, English spelling); 苦しませる → 苦しめる, 言い換える (talk back) →
    言い返す, soberu → 寝そべる, kishiru "become misty" → 軋る "creak";
  - merged repeats (外れる, 塗る); こえる split into 肥える and 越える;
  - left out "kashiru" (curse) and "sujiru" (wriggle), which aren't verbs;
  - a few meanings made clearer (始める/始まる, 増やす/増える, 変える/変わる,
    立てる, 吹く, 晴れる, 聞く);
  - added 謝る, 建てる, 間に合う and 割れる, which the site doesn't list.
  Homophones (暑い / 熱い, 合う / 会う) are never wrong options for each other,
  and a spoken answer may come back as either spelling.
- Ids are `<category>-<position>`, so reordering changes them.
- `meaning` has one string per UI language (`en`, `id`); a missing language falls
  back to `en`. `id` is the PDF's own meaning (typos fixed); `en` was written for
  the app.
- `reading` for every word written with kanji; `spellings` are other ways speech
  recognition writes the word (kanji, long-vowel kana), accepted as correct;
  `see` are the related words the PDF notes with ↔ / →.
- In the meanings, (-) means used with a negative sentence or outcome, (+) with a
  positive one, as in the PDF.

Changes from the PDF: いきいき appeared twice (merged); #84 「つざつざ: terus
menerus」 is not a real word and was left out; meanings were fixed for よくよく,
ぎゅうぎゅう(に), ぜひ and カーカー (a crow, not a chicken); せっかく had no meaning.
