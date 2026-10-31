import { normalizeReading } from './ai';

// Kana → Hepburn romaji, so the word list can be searched by typing romaji.
// Both the word and the query go through `romajiKey`, which also folds the usual
// spelling variants together (si/shi, tu/tsu, ou/oo/ō, shimbun/shinbun…).

const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo', しぇ: 'she', じぇ: 'je',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo', ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
};

const SINGLE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
};

/** Hiragana or katakana → Hepburn romaji. Other characters (kanji, Latin) are kept. */
export function kanaToRomaji(text: string): string {
  const kana = normalizeReading(text);
  let out = '';
  let double = false;
  for (let i = 0; i < kana.length; i++) {
    const ch = kana[i];
    if (ch === 'っ') { double = true; continue; }
    let roma = DIGRAPHS[kana.slice(i, i + 2)];
    if (roma) i++;
    else if (ch === 'ー') roma = out.match(/[aiueo]$/)?.[0] ?? '';
    else roma = SINGLE[ch] ?? ch;
    if (double) {
      out += roma.startsWith('ch') ? 't' : /^[a-z]/.test(roma) && !/^[aiueo]/.test(roma) ? roma[0] : '';
      double = false;
    }
    out += roma;
  }
  return out;
}

/**
 * A search key for romaji: Latin letters only, with the usual spelling variants
 * folded together ("si"/"shi", "tu"/"tsu", "shimbun"/"shinbun", "matcha"/"maccha").
 * `loose` also folds long vowels, so "toukyou", "tookyoo", "tōkyō" and "tokyo" are equal.
 */
export function romajiKey(text: string, loose = false): string {
  const key = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // ō → o, â → a
    .replace(/[^a-z]/g, '')
    .replace(/sy(?=[auo])/g, 'sh').replace(/si/g, 'shi').replace(/shhi/g, 'shi')
    .replace(/[tc]y(?=[auo])/g, 'ch').replace(/ti/g, 'chi').replace(/chhi/g, 'chi')
    .replace(/(z|j)y(?=[auo])/g, 'j').replace(/zi/g, 'ji').replace(/di/g, 'ji')
    .replace(/tu/g, 'tsu').replace(/tssu/g, 'tsu').replace(/du/g, 'zu').replace(/(?<![sc])hu/g, 'fu')
    .replace(/tch/g, 'cch')
    .replace(/m(?=[bpm])/g, 'n');
  return loose ? key.replace(/ou/g, 'o').replace(/([aiueo])\1+/g, '$1') : key;
}

/**
 * Whether a typed romaji query matches a word's romaji: from the start of the word
 * ("tabe" finds taberu), or the whole word written with or without long vowels
 * ("tokyo", "okii" for ookii). Short vowels don't match long ones as a prefix, so
 * "mou" doesn't find motsu.
 */
export function romajiMatches(wordRomaji: string, query: string): boolean {
  const q = romajiKey(query);
  if (!q) return false;
  return romajiKey(wordRomaji).startsWith(q) || romajiKey(wordRomaji, true) === romajiKey(query, true);
}
