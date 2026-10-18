import { createContext, useContext, useMemo } from 'react';
import en from './locales/en.json';
import id from './locales/id.json';

// ─── Languages ──────────────────────────────────────────
// Every UI string lives in locales/<code>.json. To add a language, copy
// en.json, translate it, and register it here; the Settings page lists
// every language in this map. A missing key is a type error.

export type Messages = typeof en;

export const LANGUAGES = {
  en,
  id: id satisfies Messages,
};

export type InstructionLanguage = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as InstructionLanguage[];

// ─── Translation ────────────────────────────────────────

/** Dot paths to every string in a locale file, e.g. "home.welcomeTitle". */
type KeyPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : KeyPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = KeyPaths<Messages>;

export type TranslateParams = Record<string, string | number>;

export type TFunction = (key: MessageKey, params?: TranslateParams) => string;

function lookup(messages: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    messages
  );
  return typeof value === 'string' ? value : undefined;
}

/** Looks up `key` in the language (falling back to English) and fills in `{name}` placeholders. */
export function translate(lang: InstructionLanguage, key: MessageKey, params?: TranslateParams): string {
  const text = lookup(LANGUAGES[lang], key) ?? lookup(LANGUAGES.en, key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function languageMeta(lang: InstructionLanguage): Messages['meta'] {
  return (LANGUAGES[lang] ?? LANGUAGES.en).meta;
}

// ─── React ──────────────────────────────────────────────

/** The active UI language; App provides it from the settings. */
export const LanguageContext = createContext<InstructionLanguage>('en');

export function useI18n(): { lang: InstructionLanguage; t: TFunction } {
  const lang = useContext(LanguageContext);
  return useMemo(() => ({ lang, t: (key, params) => translate(lang, key, params) }), [lang]);
}
