# Receipt reading and bill split: what changed and why

Goal: bill splits that are exactly right, receipt reading through OpenRouter, and the cheapest
vision model that reads Indonesian receipts reliably.

Date: 2026-11-21. All numbers below were measured with `scripts/bakeoff/run.ts` against the
fixtures in `scripts/bakeoff/fixtures/`.

## Why the totals were "slightly off"

Four separate faults, in order of impact:

1. **The vision model misread receipts and nothing checked it.** The old model
   (`gemini-2.5-flash`) got only 71% of the test receipts fully right on the first try. On the
   BOGO pizza receipt it kept counting the `(+Rp21,000)` modifier as an extra item. The prompt
   asked the model to "validate totals", but nothing in code checked whether it did.
2. **Tax was spread using the model's subtotal, not the items' sum.** `split-store` divided each
   person's share by `receiptData.subtotal`. When that printed number disagreed with the item
   lines, part of the tax or discount went missing or was double-counted.
3. **No rounding.** Shares were raw floats such as `33333.333…`. Each one was rounded on its own
   when displayed, so the per-person totals didn't add up to the grand total.
4. **The camera shrank every photo to 1024px on the longest side.** A tall receipt came out
   about 300px wide. The bakeoff's hard set shows accuracy falling sharply at that size.

## Your questions, answered

**Use OpenRouter?** Yes, done. `src/lib/server/extract-receipt.ts` calls OpenRouter directly with
`fetch`, so no SDK is needed. The model is set by `OPENROUTER_MODEL` and
`OPENROUTER_FALLBACK_MODEL`. The defaults are in `src/routes/api/analyze/+server.ts`.

**Which model?** `anthropic/claude-haiku-5.5` as the primary, with
`google/gemini-3.5-flash-lite` for the corrective retry. See the results below.

**Tools to validate the math instead of trusting the prompt?** Yes, but not as tools the agent
calls. The model now does one thing only: it copies amounts from the image as printed text.
Plain code parses the numbers, checks that items + fees − discounts equals the printed total,
and does the whole split. If the totals don't reconcile, code tells the model exactly which
totals disagree and asks once more. The math cannot be wrong; only the reading can be.

**Use a cheap model to run the split tool?** No. The split is a deterministic function of the
items and who was assigned each one. A model in that loop adds latency, cost, and a way to get
it wrong, and gains nothing. `splitBill` runs in the browser instantly every time someone ticks
an item.

## What was tried

### Model bakeoff

The fixtures are 8 receipts with hand-checked ground truth:

- your 2 real photos (`klappertaart` uses `21.363,64` decimal cents; `pizza-bogo` uses
  `Rp104,546` thousand commas and has an included modifier);
- 6 synthetic photo-like receipts from `make-synthetic.ts`:
  - service + PB1 + promo;
  - USD with cents and a tip;
  - tax already included in prices;
  - negative rounding plus a discount printed as an item line;
  - a long 14-item receipt;
  - POS decimals in `45,454.55` style.

Each receipt also has a `-hard` copy at 80% scale with heavier JPEG compression.

A run counts as **correct** only when every line total, the fee sum, the discount sum, and the
grand total all match the ground truth exactly. The other outcomes:

- **flagged:** wrong, but the totals don't reconcile, so the app shows a warning.
- **refused:** the model asked for a clearer photo.
- **silent-wrong:** wrong _and_ the totals still reconcile, so the user gets a bad split with no
  warning. This is the outcome that matters most.

**Round A: clean receipts, 8 fixtures × 3 runs each, with a retry on the same model**

| model                             | first try | correct | silent-wrong | $/receipt | p50   |
| --------------------------------- | --------- | ------- | ------------ | --------- | ----- |
| google/gemini-2.5-flash (old)     | 83%       | 88%     | 0%           | 0.00093   | 2.5s  |
| openai/gpt-6-luna                 | 100%      | 100%    | 0%           | 0.00039   | 6.9s  |
| anthropic/claude-haiku-5.5        | 100%      | 100%    | 0%           | 0.00060   | 6.1s  |
| bytedance-seed/seed-2.0-mini      | 100%      | 100%    | 0%           | 0.00071   | 8.2s  |
| google/gemini-3.1-flash-lite      | 100%      | 100%    | 0%           | 0.00123   | 7.8s  |
| google/gemini-3.5-flash-lite      | 100%      | 100%    | 0%           | 0.00179   | 6.2s  |
| nvidia/nemotron-3.5-super-vl      | 79%       | 92%     | 0%           | 0.00328   | 9.8s  |
| deepseek/deepseek-v4.1-flash-1017 | 88%       | 88%     | 0%           | 0.00191   | 14.1s |
| google/gemma-4-26b-a4b-it         | 83%       | 88%     | 0%           | 0.00017   | 4.1s  |
| qwen/qwen3.8-flash                | 79%       | 83%     | 0%           | 0.00078   | 21.7s |
| xiaomi/mimo-v2.6-flash            | 71%       | 71%     | 0%           | 0.00066   | 10.6s |
| z-ai/glm-5.3-flash                | 67%       | 71%     | 0%           | 0.00069   | 8.1s  |
| qwen/qwen3.8-27b                  | 63%       | 67%     | 0%           | 0.00442   | 6.7s  |
| mistralai/mistral-small-3.2-24b   | 58%       | 63%     | 0%           | 0.00019   | 7.1s  |
| inclusionai/ling-3.0-flash-vl     | 50%       | 63%     | 0%           | 0.00050   | 22.3s |
| minimax/minimax-m3.1-flash        | 42%       | 54%     | 0%           | 0.00086   | 2.8s  |
| meta-llama/llama-4-scout          | 38%       | 50%     | 8%           | 0.00033   | 5.9s  |
| qwen/qwen3.6-35b-a3b              | 42%       | 46%     | 0%           | 0.00192   | 34.9s |

The open-weight models ranked from Nemotron down are out. None of them reached 100% on clean
receipts, and several hit the 45s timeout. Gemma 4 is the cheapest decent one ($0.00017), but
13% of its runs returned output that failed to parse, even after the retry.

**Round B: hard receipts, top 5 models, 8 fixtures × 3 runs each, with a retry on the same model**

| model                        | first try | correct | silent-wrong | $/receipt | p50   |
| ---------------------------- | --------- | ------- | ------------ | --------- | ----- |
| anthropic/claude-haiku-5.5   | 88%       | **92%** | **0%**       | 0.00088   | 5.4s  |
| google/gemini-3.5-flash-lite | 88%       | 88%     | 0%           | 0.00208   | 2.1s  |
| google/gemini-3.1-flash-lite | 79%       | 79%     | 0%           | 0.00145   | 2.0s  |
| bytedance-seed/seed-2.0-mini | 75%       | 75%     | 0%           | 0.00120   | 11.4s |
| openai/gpt-6-luna            | 58%       | 63%     | **25%**      | 0.00085   | 9.6s  |

GPT-6 Luna is the cheapest on clean receipts but the most dangerous on blurry ones. In a quarter
of the hard runs it produced numbers that reconcile and are still wrong, so no warning would
appear.

**Round C: Haiku with a Gemini 3.5 Flash Lite retry, hard receipts, 8 fixtures × 5 runs**

| setup                             | first try | correct | silent-wrong | $/receipt | p50  |
| --------------------------------- | --------- | ------- | ------------ | --------- | ---- |
| haiku-5.5 → gemini-3.5-flash-lite | 85%       | **98%** | 0%           | 0.00107   | 5.2s |

Retrying with a model from another vendor fixes most of Haiku's misses, because the two models
make different mistakes. Retrying with Haiku itself only went from 88% to 92%.

**What the bakeoff cannot tell you:**

- Only 2 of the 8 receipts are real photos. The synthetic ones are cleaner than a crumpled bill
  under restaurant lighting.
- 24–40 runs per model separate 98% from 88%, but not 100% from 98%. Add real receipts to
  `fixtures/` (an image plus a `.json` truth file) and rerun to tighten this.
- Latency was measured under 12 parallel requests, so p50 times are higher than a single user
  sees.
- The two rounds disagree on Gemini's speed (2s in one, 6–8s in the other). Don't treat any
  latency figure here as exact.

### Rejected alternatives

- **Agent with math tools (add, multiply, tool calling).** The model would still choose which
  numbers to add, and that choice is where the errors come from. Deterministic code with one
  feedback retry is cheaper and can be tested.
- **Cheap model to run the split.** A pure function does it exactly, for free.
- **Having the model output numbers directly.** This is how the first version worked. It forces
  the model to guess the separator format (`45.000` vs `21.363,64` vs `104,546`) on every value.
  The model now copies the text as printed, and `parseAmount` decides with one rule: if the last
  separator is followed by exactly 3 digits it separates thousands, if followed by 1–2 digits it
  is the decimal point.
- **Rounding everything to whole rupiah when reading the receipt.** This breaks reconciliation
  on POS receipts that print cents (`21.363,64` × 7 lines only adds up to `180.909,09` with the
  cents kept). Cents are kept through the math. Only each person's final total is settled to
  whole rupiah.
- **Rounding each person to Rp100 (the smallest coin).** Not done. The per-person totals then
  could not add up to the bill exactly, and most people pay by QRIS or transfer, which is exact
  to the rupiah. It's an easy option to add later if wanted.
- **Google GenAI SDK or OpenAI SDK.** One `fetch` call is enough, and the GenAI dependency is
  gone.

## What changed

**Calculation (`src/lib/bill.ts`, all pure and unit-tested)**

- Money is stored as integers in the receipt's smallest unit, so there is no float drift.
- Items store the line total as printed, not unit price × quantity.
- `allocate` uses the largest-remainder method: every split (an item shared ÷3, the fee share,
  the discount share) adds back up exactly.
- Fees and discounts are spread in proportion to each person's item subtotal. The denominator is
  the sum of the items, not the model's subtotal.
- IDR (and JPY/KRW/VND) person totals are settled to whole units while keeping the sum equal to
  the bill. The verified klappertaart split: 43.334 + 85.833 + 69.833 = 199.000.
- `reconcile` compares items + fees − discounts with the printed total, and accepts a subtotal
  printed either before or after discounts.

**Reading the receipt (`src/lib/server/extract-receipt.ts`)**

- One zod schema drives OpenRouter's `response_format` (strict JSON schema) and the
  `safeParse` of the reply.
- The model returns amounts as printed text. `parseAmount` (`src/lib/parse-amount.ts`) handles
  `45.000`, `45,000`, `21.363,64`, `21,363.64`, `$12.50`, `1,00`, `-16.500`, `(16.500)` and
  `16.500-`.
- Code computes a line total from quantity × unit price when only the unit price is printed. A
  negative item line becomes a discount.
- If parsing fails or the totals don't reconcile, the model gets one retry. The retry message
  states exactly which totals disagree and tells the model not to fudge numbers to force a
  match. The best attempt is kept.
- Each call times out after 45s. A failed retry falls back to the first reading. An image the
  model can't read comes back as a 422 asking for a clearer photo.

**App bugs fixed**

- `error(422)` was thrown inside `try` and swallowed by the `catch`, so "not a receipt" showed up
  as a generic 500. The real reason now reaches the user.
- `parsed.items.map` crashed when the model omitted `items`. zod now rejects that before it is
  used.
- The fee and discount lists were keyed by label, so two lines labelled "Service" crashed the
  page. They are now keyed by id.
- The amount formatter could show 3 decimals (`33.333,333`). Amounts are now formatted per
  currency.
- The split page showed the printed total as fact. It now shows the computed total and warns when
  that differs from the printed total.
- The summary's grand total is now the sum of the people's totals.
- The session cache key used the image length plus 64 header characters, so two photos from the
  same camera could collide. It now uses a SHA-256 of the image, versioned `v2` so old cached
  results in the previous format are ignored.
- The camera resolution went from 1024 to 1600px on the longest side. The camera stream now
  stops when you leave the page.
- Dead code was removed: `Counter.svelte`, the empty `utils/formatter.ts`, the
  `@google/genai` dependency, and a duplicated split function in `split-store`.

**Tooling**

- `pnpm test` runs vitest: 30 tests covering the parser, allocation, the split and
  reconciliation.
- `pnpm bakeoff [runs] [model…]` reruns the model comparison. `FIXTURES=regex` filters the
  receipts and `FALLBACK=model` tests a retry pairing.
- `scripts/bakeoff/make-synthetic.ts` regenerates the synthetic receipts with headless Chrome.

## Verification

- `pnpm check`: 0 errors. `pnpm lint`: clean. `pnpm test`: 30/30 pass.
- End to end in headless Chrome against the dev server, through camera → loading → split →
  summary, with the real Haiku call:
  - `klappertaart`: 3 people, totals sum to exactly 199.000.
  - `pizza-bogo`: 3 people, totals sum to exactly 244.001 at $0.00064. The tax shares
    (12.455 / 4.454 / 5.273) were checked by hand against the exact proportions.
- A non-receipt image returns a 422 with the model's reason.

## Correcting misread receipts (added after the bakeoff)

When the reading is wrong, people can fix it on the split page:

- Tap ✎ on any item, fee or discount to change its name or amount, or to remove it.
- "+ Item / + Fee / + Discount" adds a line the model missed.
- When the warning shows, the printed total in it is editable too, in case that's the misread.

Every edit goes through one store function (`edit` in `src/lib/receipt-store.svelte.ts`) that
recomputes the reconciliation, so the warning updates the moment the numbers match. Typed
amounts use the same `parseAmount` as the model output. The edit field shows the full stored
value (`21.363,64`), so saving an unchanged line never drops POS cents. Typing cents on a
receipt that had none switches the whole receipt to cents.

This was verified in headless Chrome on the pizza receipt:

1. A misread was introduced (Potato Wedges changed to 2.000), and the warning appeared.
2. Bad input ("abc") was rejected with a message.
3. The line was fixed, and the warning cleared.
4. A missing item was added, and the totals updated.

## Open follow-ups

- **Choosing a photo from the gallery.** The app only accepts a live camera shot. A
  `<input type="file" accept="image/*">` would allow existing photos.
- **Editing quantity.** Only the line amount is editable; the quantity shown is display-only and
  isn't used in the split.
- **More real receipts in `fixtures/`.** This is the cheapest way to make the model choice
  trustworthy. Rerun `pnpm bakeoff` after adding them.
