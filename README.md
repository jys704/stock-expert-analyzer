# Stock Expert Analyzer

Stock Expert Analyzer ships two cooperating pieces in a single repository:

1. **Python CLI** (`src/stock_expert_analyzer/`) — an offline-friendly command-line tool that reads local OHLCV CSV data, computes technical indicators, and prints a trend / risk / recommendation summary.
2. **Web app** (`client/`, `server/`, `shared/`) — a React + Vite + tRPC + Firebase Authentication front-end with an Express + Drizzle backend that surfaces the same analysis through a browser interface and lets approved users export a PDF report.

You can use either part independently. The Python CLI has no dependencies on the web app and vice versa.

> This project is for research and education. It is not financial advice.

## Current Status

The repository now contains a working MVP with:

- CSV loading for daily OHLCV price bars.
- Technical indicators: short/long simple moving averages, RSI, total sample price change, and annualized volatility.
- Rule-based trend, risk, and recommendation classification.
- A command-line interface with text and JSON output.
- Automated tests covering indicators, analyzer behavior, CSV loading, and CLI output.
- A Korean stock-market strength dashboard with market summary, theme/sector ranking, bullish stock filtering, a 100-point score model, and top-3 recommendation cards.

## Installation

Use Python 3.10 or newer.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

For tests, install pytest if it is not already available:

```bash
python -m pip install pytest
```

## CSV Format

Provide a CSV with these columns:

```csv
date,open,high,low,close,volume
2025-01-02,100.25,101.00,99.80,100.70,1000000
```

Required columns are `date`, `open`, `high`, `low`, and `close`. The `volume` column is optional. Dates must use `YYYY-MM-DD` format.

A sample file is available at `examples/sample_prices.csv`.

## Usage

Text report:

```bash
stock-expert-analyzer AAPL examples/sample_prices.csv
```

JSON report:

```bash
stock-expert-analyzer AAPL examples/sample_prices.csv --json
```

Without installing the console script, run the module directly:

```bash
PYTHONPATH=src python -m stock_expert_analyzer.cli AAPL examples/sample_prices.csv --json
```

## Development

Run tests:

```bash
python -m pytest
```

## Web App

The browser interface is a Vite-powered React 19 app with shadcn/ui components, tRPC, Firebase Authentication, and Drizzle ORM.

### Layout

- `client/` — Vite root with `index.html`, `public/`, and `src/` (App.tsx, pages, components, hooks, lib, contexts).
- `server/` — Express + tRPC entry point (`_core/index.ts`) plus routers, storage, Firebase auth helpers.
- `server/marketData.ts` — market snapshot provider. It tries a Yahoo Finance delayed-quote provider first and safely falls back to bundled sample data when external data is unavailable.
- `shared/` — types and constants imported by both client and server.
- `drizzle/` — generated SQL migrations and schema for the analysis database.

### Market data behavior

The dashboard reads data from the tRPC endpoint:

```text
market.snapshot
```

Current provider behavior:

- Uses Yahoo Finance delayed quote data for KOSPI/KOSDAQ indices and tracked Korean stock symbols when network access is available.
- Optionally enriches stock rows with DART disclosures when `DART_API_KEY` is present.
- Optionally enriches stock rows with Naver News Search results when `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` are present.
- Recomputes price change, volume ratio, estimated turnover, theme strength, sector strength, and the market briefing from the latest provider response.
- Keeps institution/foreign/program flow, news, and disclosure as enrichment fields until a paid brokerage/KRX/news/DART provider is connected.
- Falls back to sample data automatically, so the app still works offline or when the provider blocks a request.
- Caches each snapshot for 60 seconds to avoid repeated provider calls.

Optional environment keys:

```bash
DART_API_KEY=your_opendart_key
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

Without these keys, the dashboard shows a "키 필요" provider status and keeps using the built-in enrichment text.

For a production service, replace or extend `server/marketData.ts` with licensed providers:

- 시세: KRX, 증권사 OpenAPI, 또는 유료 마켓 데이터 공급자
- 수급: 투자자별 매매동향 API
- 공시: DART OpenAPI
- 뉴스: 뉴스 API 또는 크롤링 허가를 받은 데이터 공급자

### Configure environment

Copy the templates and fill them in before running:

```bash
cp firebase.env.template .env
cp .firebaserc.example .firebaserc
```

`.env` must contain valid `VITE_FIREBASE_*` values (apiKey, authDomain, projectId, etc.) and any backend secrets used by `server/_core/env.ts`. See `HANDOFF.md` for the full hand-off checklist.

### Install dependencies

The repo uses `pnpm` (see `packageManager` in `package.json`):

```bash
pnpm install
```

### Common scripts

```bash
pnpm dev      # start the dev server (server + Vite)
pnpm build    # production build (Vite + esbuild)
pnpm start    # serve the production build
pnpm check    # TypeScript type check (tsc --noEmit)
pnpm test     # run vitest server tests
pnpm db:push  # generate and apply Drizzle migrations
```

## Next Steps

Recommended follow-up work:

1. Connect licensed real-time Korean market data for foreign/institution/program flows.
2. Connect DART disclosures and a news provider for automatic issue classification.
3. Add fundamentals such as revenue growth, margins, debt ratios, and valuation multiples.
4. Add portfolio-level analysis and position sizing guidance.
