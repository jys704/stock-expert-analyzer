"""Command-line interface for Stock Expert Analyzer."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict

from .analyzer import analyze_prices
from .data import load_price_bars_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze a stock from local OHLCV CSV data.")
    parser.add_argument("symbol", help="Ticker symbol to label the analysis, e.g. AAPL")
    parser.add_argument("csv", help="Path to a CSV with date, open, high, low, close, and optional volume columns")
    parser.add_argument("--short-window", type=int, default=20, help="Short SMA window; default: 20")
    parser.add_argument("--long-window", type=int, default=50, help="Long SMA window; default: 50")
    parser.add_argument("--rsi-period", type=int, default=14, help="RSI period; default: 14")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON instead of a text report")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    bars = load_price_bars_csv(args.csv)
    result = analyze_prices(
        args.symbol,
        bars,
        short_window=args.short_window,
        long_window=args.long_window,
        rsi_period=args.rsi_period,
    )

    if args.json:
        print(json.dumps(asdict(result), indent=2))
    else:
        print(_format_text_report(result))
    return 0


def _format_text_report(result) -> str:
    lines = [
        f"Stock Expert Analysis: {result.symbol}",
        f"Latest close: {result.latest_close}",
        f"Sample change: {result.price_change_percent}%",
        f"Short SMA: {_format_optional(result.sma_short)}",
        f"Long SMA: {_format_optional(result.sma_long)}",
        f"RSI: {_format_optional(result.rsi)}",
        f"Annualized volatility: {_format_optional(result.annualized_volatility_percent, suffix='%')}",
        f"Trend: {result.trend}",
        f"Risk: {result.risk_level}",
        f"Recommendation: {result.recommendation}",
        "Reasons:",
    ]
    lines.extend(f"- {reason}" for reason in result.reasons)
    return "\n".join(lines)


def _format_optional(value: float | None, suffix: str = "") -> str:
    return "n/a" if value is None else f"{value}{suffix}"


if __name__ == "__main__":
    raise SystemExit(main())