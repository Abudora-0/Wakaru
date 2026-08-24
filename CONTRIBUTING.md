# Contributing to Wakaru

## Setup

```bash
npm install
npm run dev
```

No keys, no accounts, no `.env` needed. Everything works anonymously.

## Adding a dialect

This is the most useful contribution anyone can make, and it is a one file
change. Append an object to
[`packages/core/src/dialects/data.ts`](packages/core/src/dialects/data.ts):

```ts
{
  code: "es-CL",              // BCP-47
  base: "es",                 // the language it refines
  name: "Chilean Spanish",
  native: "Español chileno",
  region: "Chile",
  providerLocale: "es-CL",    // omit unless a provider understands the region
  ttsLocales: ["es-CL", "es-419"],
  summary: "One sentence a reader will see on the languages page.",
  lexicon: [
    { from: "autobús", to: "micro", confidence: "high" },
    { from: "niño", to: "cabro", confidence: "low", note: "informal register only" },
  ],
}
```

### What the confidence levels mean

They are shown to the reader, so they need to be honest:

- **high** the original word is simply wrong in this region, or means something
  else, or is offensive there
- **medium** it is understood but marked as foreign
- **low** it is a register or slang preference, not a correction

### Rules of thumb

- The `from` side is **what the translation provider produced**, not the
  English. You are correcting a machine translation, not writing a phrasebook.
- Prefer fewer, certain entries over many uncertain ones. A wrong substitution
  is worse than no substitution, because the reader trusts the edit ledger.
- Add a `note` whenever the reason is not obvious, especially where a word is
  vulgar or offensive in the target region. That note is displayed.
- Do not attempt grammar. The overlay substitutes words, it does not conjugate.
  If a dialect needs verb changes, say so in `summary` rather than faking it.

Add a case to `packages/core/src/dialects/dialects.test.ts` and run
`npm test`.

## Adding a language

Append a row to
[`packages/core/src/languages/data.ts`](packages/core/src/languages/data.ts):

```ts
["yue", "Cantonese", "粵語", "Hant", "ltr", "Sino-Tibetan"],
```

Columns are code, English name, endonym, ISO 15924 script, direction, family.
The endonym matters: the interface shows a language's own name first, and the
combobox derives its sample glyph from it.

## House style

### No em dashes

Not in code, not in UI copy, not in documentation. Use a comma, a colon, or
split the sentence. This is enforced by `scripts/check-no-emdash.mjs` in the
pre-commit hook and in CI, and it fails the build.

```bash
npm run check:emdash
```

### Commits

Conventional Commits, and **no AI or assistant attribution**. No
`Co-Authored-By` trailer for a tool, no generated-with footer.

```
feat(core): add Chilean Spanish dialect overlay
fix(ocr): keep faint strokes when binarising dim scans
docs: explain why the Google endpoint ships disabled
```

### Tests

`npm test` must never touch the network. It runs against recorded fixtures so
it cannot fail because a free provider is down, and cannot spend a daily quota
in CI. Live checks belong in a `*.live.test.ts` file and run only under
`npm run test:live`.

### Comments

Explain why, not what. The interesting comments in this codebase are the ones
that record a decision: why Otsu averages the variance plateau, why the
extension fetches image bytes in the background, why the language picker shows
script samples rather than flags. Match that.

## Before opening a pull request

```bash
npm run check
```

That runs the style guard, the type check and the tests.

## Brand assets

Never hand edit anything in `apps/*/public`. Edit the four sources in `brand/`
and run `npm run brand:build`. See [brand/README.md](brand/README.md).
