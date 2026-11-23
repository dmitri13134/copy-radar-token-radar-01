# Copy Radar — token launch radar as copy-trading signals

A token launch radar for make.fun's `token-radar-01` bounty. It reads the
sealed DefiLlama snapshot, ranks every pre-token protocol by an implied value,
and shows each one as a copy-trading signal: mirror the crowd's committed
capital before a token exists.

## The idea

Each pre-token protocol is a position the crowd has already taken:

- **TVL** is the crowd's committed capital.
- **7-day TVL change** is the flow of new capital in or out.
- **Tenure with no token recorded** is the accumulation window.
- **Chain count** is how widely the crowd is spread.

One function, `copySignal` in `lib/model.ts`, turns those four snapshot
figures into an implied value and a copy score (0–100), then a signal:
**STRONG MIRROR** (65+, mirror with $250), **MIRROR** (45+, $150),
**WATCH** (25+, $100), **TRACK** (else, $50). No protocol name is ever
special-cased.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` (Node 22, standard library only) writes `board.json`, `data.js`,
copies `dashboard/` and `screenshots/`, and writes `dossier.json` with the
vendored make.fun library. The run is deterministic: the same snapshot always
writes the same bytes.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board
(search, category, signal, chain, minimum TVL), a detail view per protocol
with its signal breakdown and six-step farm plan (each step states its cost
and time), a Live view of tokens that already trade (shown at the market's
own value, never a model claim), and a Signal model view with a tuner that
re-ranks the board live under different weights.

## Files

- `main.ts` — entry point: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the copy-trading signal model, the board builder, the
  farm-plan generator, and the gate self-check.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from the kit.
- `dashboard/` — `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a detail view, and a filtered view.

## Honesty notes

“Records no token” means the snapshot's record carries none — never that the
protocol has none. An implied value is this radar's own claim, not a
prediction that a token is issued or when. Farm plans are a reader's
checklist, not financial advice.
