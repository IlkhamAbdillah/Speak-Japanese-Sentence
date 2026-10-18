# CLAUDE.md

Guidance for Claude Code sessions working on this repo.

## What this is

**SpeakJP**: a browser-only Japanese practice app (React 19 + TypeScript + Vite, no backend). The user answers in Japanese by speaking (Web Speech API, `ja-JP`) or typing. An AI provider generates the questions and grades the free-text answers. Settings and session history live in `localStorage`. The UI is bilingual: every user-facing string has an English and an Indonesian version (`lang === 'id' ? '…' : '…'`).

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build  — run before calling work done
npx tsc -b       # type-check only
npm run lint     # oxlint (3 pre-existing set-state-in-effect warnings are known; don't add new ones)
```

There are no automated tests. See "Verifying changes" below.

## Modes

The user picks these in `components/ModePicker.tsx`, which is shown on both Home and Settings.

| Setting | Values | Notes |
|---|---|---|
| `appMode` | `practice` \| `jlpt` | top-level mode |
| `exerciseMode` (practice) | `translation` \| `situation` \| `conversation` | conversation is a separate chat page |
| `jlptSection` (jlpt) | `kanji` \| `reading` | JLPT Mock Test sections |
| `examMode` | boolean | one attempt and the explanation shown right away; not available for conversation or reading (see `canUseExamMode`) |

Use the helpers in `src/types/index.ts` instead of comparing fields directly: `isConversationMode`, `isKanjiMode`, `isMultipleChoiceMode` (= reading), `isExamMode`, `canUseExamMode`, `getSessionModeLabel`. In `hooks/useSession.ts`, `getMaxAttempts()` returns 1 for exam mode and for multiple choice.

How each mode behaves:
- **Translation / Situation**: the AI generates the questions and the AI evaluates the answers (`evaluateAnswer` in `services/ai.ts`). The evaluator keeps a short verdict in `feedback` separate from the explanations in `grammarNotes`/`vocabularyNotes`/`hint`. On a wrong answer the explanations count as hints and are hidden when `hintsEnabled` is off.
- **Conversation**: `pages/ConversationPage.tsx` + `hooks/useConversation.ts` + `components/ChatBubble.tsx`. The chat looks like a messaging app. The user gives a topic or picks a random one. Each AI reply returns `{reply, translation, correction}`. The session is saved only after the user has sent at least one message.
- **JLPT Kanji**:
  - The AI generates the words and readings. Its prompt excludes kanji from lower JLPT levels: it asks for `kanjiLevel` + 5 extra words, then filters by that field.
  - Answers are checked **locally** with no AI call (`evaluateKanjiAnswer`): katakana→hiragana normalisation; the reading, alternative readings, the kanji itself, and `sameSoundSpellings` all count as correct.
  - "Show Answer" before answering means giving up (`revealAnswer` in useSession).
- **JLPT Reading**:
  - The AI generates one passage with exactly `READING_QUESTION_COUNT` (3) multiple-choice questions, each with 4 choices and an explanation.
  - The app shuffles the choices itself, because the AI tends to put the answer first.
  - The answer is checked locally via `submitChoice`, with no AI call.
  - The passage is shown on every question.

## Answer flow rules (user-requested; keep them)

- The answer input is always visible and focused; there's no "click to type" step. Enter submits, guarded by `!e.nativeEvent.isComposing` for the Japanese IME.
- **Voice** (`services/speech.ts`, `startRecognition`):
  - Practice: continuous listening; the answer is submitted after `SILENCE_SUBMIT_MS` (3s) of silence.
  - Kanji: `waitForSilence: false`; the answer is submitted on the first final result.
  - The mic ■ button **cancels** and discards the recording (`stopRecognition`). It never submits. An answer is submitted only by pressing Enter or by recognition finishing on its own.
  - In Conversation, speech fills the message box; cancelling restores whatever text was typed before.
- **A correct answer gets no explanation.** Show the "Correct!" flash and auto-advance after `CORRECT_ADVANCE_MS` (1.2s). There's no auto-advance setting; it was removed on purpose.
- A wrong answer shows feedback with Try Again, Next and Show Answer as applicable. In multiple choice the right option is marked green and the user's wrong pick red.

## Architecture notes

- `services/ai.ts`:
  - One `callProvider` covers OpenAI, Gemini, Anthropic (direct browser access) and Ollama/OpenAI-compatible URLs. `aiConfigFromSettings(settings)` builds the config.
  - `MAX_OUTPUT_TOKENS = 8192`: reading tests are long, and Gemini 2.5 spends part of the budget on reasoning.
  - `extractJSON` returns the first balanced JSON value, so text the AI adds before or after it is ignored. Always parse AI output through it.
  - Inside prompts, user transcripts are labelled UNTRUSTED.
- `services/storage.ts` → `loadSettings()` migrates old saved settings:
  - `exerciseMode: 'japanese-response'` → `conversation`
  - `appMode: 'exam'` → practice + `examMode`
  - `appMode: 'kanji'` → `jlpt`/`kanji`
  - an unknown `jlptSection` (grammar was removed) → `kanji`
- Sessions keep their legacy `appMode` values, typed as `StoredAppMode`; `getSessionModeLabel` handles them.
- Conversation sessions have `messageCount` in their summary and are left out of the accuracy stats.
- Styling: plain CSS in `src/index.css` using design tokens (`--space-*`, `--accent-primary`, …). The app is dark-themed only. Add new styles as sections at the end of the file.
- `PracticePage.tsx`: `goToNextQuestion` must reset per-question UI state. Effects that need the latest callback read it through a ref, because `nextQuestion` changes identity on every 100ms timer tick.

## Verifying changes

The user can't easily check every flow by hand, so test end-to-end before reporting:
1. Run a small Node mock of the OpenAI-compatible `/v1/chat/completions` API. It must allow CORS and return canned JSON, chosen by matching text in the system prompt.
2. Set `localStorage.sjp_settings` to `{aiProvider:'ollama', ollamaBaseUrl:'http://localhost:<port>/v1', …}`.
3. Drive the app with Playwright headless Chromium.
4. Fake speech recognition by overriding **both** `window.SpeechRecognition` and `window.webkitSpeechRecognition` in an init script (headless Chrome has a native one).

The machine (WSL) lacks Chromium's system libraries. Fetch them with `apt-get download libnspr4 libnss3 libasound2t64`, extract them with `dpkg -x`, and point `LD_LIBRARY_PATH` at them. Kill dev and mock servers when done (`fuser -k <port>/tcp`).

After editing files, a running `npm run dev` can keep a half-edited module loaded (e.g. "X is not defined"). Tell the user to restart the dev server and hard-refresh before treating that as a code bug.

## Working with this user

- They write requests in short, informal English, sometimes with typos (e.g. "conservation" meant "conversation").
- Larger requests come in `fix.md`. `fix.md` and `idea.md` are git-ignored personal notes, and `idea.md` is the original product brief.
- They commit themselves. Don't commit unless asked.
- When a request is ambiguous, pick the reading closest to the real JLPT / messaging-app experience and say which choice you made.
- Grammar questions were tried and removed ("kinda suck"). Don't bring them back unless asked.
