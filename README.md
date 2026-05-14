# stock-expert-analyzer
# Stock Expert Analyzer

Stock Expert Analyzer is an offline-friendly Python CLI for reviewing local stock OHLCV data. It calculates common technical indicators, classifies trend and risk, and produces a concise recommendation summary.

> This project is for research and education. It is not financial advice.

## Current Status

The repository now contains a working MVP with:

- CSV loading for daily OHLCV price bars.
- Technical indicators: short/long simple moving averages, RSI, total sample price change, and annualized volatility.
- Rule-based trend, risk, and recommendation classification.
- A command-line interface with text and JSON output.
- Automated tests covering indicators, analyzer behavior, CSV loading, and CLI output.

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

## Next Steps

Recommended follow-up work:

1. Add an optional market-data provider integration behind a stable interface.
2. Add fundamentals such as revenue growth, margins, debt ratios, and valuation multiples.
3. Add portfolio-level analysis and position sizing guidance.
4. Export reports to HTML or Markdown for sharing.