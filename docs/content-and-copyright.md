# Content and copyright rules for Aziiki

This explains how Aziiki uses ideas from published books and from other
people's games, and the rules to follow when adding more. It is a working
policy, **not legal advice**. See "Before you launch commercially" at the end.

## The principle

Copyright protects **how something is written or drawn** (the exact words,
stories, pictures, card designs), not the **ideas** in it. "Save a tenth of
what you earn" or "assets pay you, liabilities cost you" are ideas anyone may
teach. A book's sentences, chapter titles, characters and stories are not.

Trademarks are separate: a name or logo that identifies a product (a book
series, a board game) can't be used as *your* branding.

## What Aziiki does

| Area | What we do |
|---|---|
| **Book Library** (`src/lib/bookLibrary.ts`) | Every lesson is written from scratch in Aziiki's own voice: a short idea, what it means for a small business, and something to do in Aziiki. No quotations, no excerpts, no chapter titles, no characters or stories. |
| **Naming the books** | A book and its author are named only to say where an idea comes from, and readers are pointed to the book. We don't use covers, logos or brand colours, and never suggest an author or publisher endorses Aziiki. |
| **The game** (`src/lib/quadrantGame`, `FourWaysToEarnGame.tsx`) | "Four Ways to Earn" is Aziiki's own game: its own rules, cards, professions, numbers and name. It uses no brand names, card names or terms belonging to any board game or book series, and it isn't a copy of any game's layout. |
| **Live market data** | Figures come from public web pages through Google Search. Each one shows its own date and website, so Aziiki is quoting facts with credit, not copying a data provider's product. |
| **Fonts and icons** | Montserrat and JetBrains Mono (SIL Open Font License, self-hosted through Fontsource) and Phosphor icons (MIT). |

## Rules when adding or editing content

1. **Write it yourself.** Read the idea, close the book, write it in your own words. Never paste or lightly reword a sentence.
2. **No quotation marks** in lesson text, no quoted lines, no epigraphs.
3. **Don't reuse a book's chapter titles, characters, parables or catchphrases**, even paraphrased closely. Give the idea your own title.
4. **Keep it short.** The test enforces a maximum length. A summary that gets long starts to substitute for the book.
5. **Always end with something to do in Aziiki.** That keeps the lesson Aziiki's own teaching.
6. **Name the source, don't borrow its brand.** Book title and author as attribution only. No covers, logos, or the series' trademarked names as *our* feature names.
7. **Games:** invent the rules, names and numbers. Generic ideas (earning income, building assets, saving) are fine; someone else's named mechanics, cards and terms are not.
8. **Add a book only if** you can write original lessons about it. Public-domain books (older than the applicable term in your country) are the safest source; check before assuming.

`src/lib/bookLibrary.test.ts` enforces the mechanical rules (no quotes, length limits, a blocklist of chapter titles and brand terms, no book covers bundled). If a test fails, fix the content, don't loosen the test.

## Before you launch commercially

- Have an IP or trademark lawyer look at the **book titles used as attribution** and the game name "Four Ways to Earn" (a trademark search in the countries you sell in takes little time and is cheap).
- If you ever want to quote a book, show a cover, or use an author's name in marketing, ask the publisher for **written permission**.
- If a rights holder contacts you, remove the content first and talk second. Every lesson is one entry in one file, so that is quick.

## Live market figures: accuracy

Aziiki doesn't invent or estimate market numbers. A figure is shown only if the model found it in a Google Search result, names the website, and that website is one Google actually returned (see `src/server/marketData.ts`). Anything that fails is dropped, and if nothing survives, Aziiki says so instead of showing numbers. This makes wrong figures much less likely, but it can't make them impossible: a source page can lag or be wrong. The screen tells people to confirm with their bank, broker or the exchange, and shows each figure's date and source so they can.
