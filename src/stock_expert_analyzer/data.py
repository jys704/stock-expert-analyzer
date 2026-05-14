"""Price data loading utilities."""

from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from .models import PriceBar

REQUIRED_COLUMNS = {"date", "open", "high", "low", "close"}


def load_price_bars_csv(path: str | Path) -> list[PriceBar]:
    """Load OHLCV price bars from a CSV file.

    Expected columns are: date, open, high, low, close, and optional volume.
    Dates must use ISO format (YYYY-MM-DD).
    """

    csv_path = Path(path)
    with csv_path.open(newline="", encoding="utf-8") as file_handle:
        reader = csv.DictReader(file_handle)
        fieldnames = {name.strip().lower() for name in (reader.fieldnames or [])}
        missing = REQUIRED_COLUMNS - fieldnames
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

        bars = [_row_to_price_bar(row) for row in reader]

    if not bars:
        raise ValueError("CSV does not contain any price rows")
    return bars


def _row_to_price_bar(row: dict[str, str]) -> PriceBar:
    normalized = {key.strip().lower(): value for key, value in row.items()}
    return PriceBar(
        date=date.fromisoformat(normalized["date"]),
        open=float(normalized["open"]),
        high=float(normalized["high"]),
        low=float(normalized["low"]),
        close=float(normalized["close"]),
        volume=int(float(normalized.get("volume") or 0)),
    )