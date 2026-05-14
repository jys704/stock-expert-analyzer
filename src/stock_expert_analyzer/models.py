"""Core data models for stock analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class PriceBar:
    """A single end-of-day OHLCV price record."""

    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int = 0


@dataclass(frozen=True)
class AnalysisResult:
    """Computed stock analysis summary."""

    symbol: str
    latest_close: float
    price_change_percent: float
    sma_short: float | None
    sma_long: float | None
    rsi: float | None
    annualized_volatility_percent: float | None
    trend: str
    risk_level: str
    recommendation: str
    reasons: list[str] = field(default_factory=list)