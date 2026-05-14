"""Stock analysis orchestration."""

from __future__ import annotations

from .indicators import annualized_volatility, percent_change, relative_strength_index, simple_moving_average
from .models import AnalysisResult, PriceBar


def analyze_prices(
    symbol: str,
    prices: list[PriceBar],
    short_window: int = 20,
    long_window: int = 50,
    rsi_period: int = 14,
) -> AnalysisResult:
    """Analyze price bars and return trend, risk, and recommendation signals."""

    if not symbol.strip():
        raise ValueError("symbol is required")
    if len(prices) < 2:
        raise ValueError("at least two price bars are required")
    if short_window >= long_window:
        raise ValueError("short_window must be smaller than long_window")

    ordered = sorted(prices, key=lambda item: item.date)
    closes = [bar.close for bar in ordered]

    latest_close = closes[-1]
    change = percent_change(closes[0], latest_close)
    sma_short = simple_moving_average(closes, short_window)
    sma_long = simple_moving_average(closes, long_window)
    rsi = relative_strength_index(closes, rsi_period)
    volatility = annualized_volatility(closes)

    trend, trend_reason = _classify_trend(latest_close, sma_short, sma_long, change)
    risk_level, risk_reason = _classify_risk(volatility, rsi)
    recommendation, recommendation_reason = _recommend(trend, risk_level, rsi)

    reasons = [trend_reason, risk_reason, recommendation_reason]

    return AnalysisResult(
        symbol=symbol.strip().upper(),
        latest_close=round(latest_close, 4),
        price_change_percent=round(change, 2),
        sma_short=round(sma_short, 4) if sma_short is not None else None,
        sma_long=round(sma_long, 4) if sma_long is not None else None,
        rsi=round(rsi, 2) if rsi is not None else None,
        annualized_volatility_percent=round(volatility, 2) if volatility is not None else None,
        trend=trend,
        risk_level=risk_level,
        recommendation=recommendation,
        reasons=reasons,
    )


def _classify_trend(latest_close: float, sma_short: float | None, sma_long: float | None, change: float) -> tuple[str, str]:
    if sma_short is None or sma_long is None:
        if change > 2:
            return "uptrend", "Price rose more than 2% across the available sample."
        if change < -2:
            return "downtrend", "Price fell more than 2% across the available sample."
        return "sideways", "Not enough moving-average history; price change is muted."

    if latest_close > sma_short > sma_long:
        return "uptrend", "Latest close is above the short SMA, which is above the long SMA."
    if latest_close < sma_short < sma_long:
        return "downtrend", "Latest close is below the short SMA, which is below the long SMA."
    return "sideways", "Moving averages are mixed and do not confirm a strong trend."


def _classify_risk(volatility: float | None, rsi: float | None) -> tuple[str, str]:
    if volatility is None:
        return "unknown", "Not enough observations to estimate volatility."

    if volatility >= 45 or (rsi is not None and (rsi >= 75 or rsi <= 25)):
        return "high", "Volatility is elevated or RSI is in an extreme zone."
    if volatility >= 25 or (rsi is not None and (rsi >= 65 or rsi <= 35)):
        return "medium", "Volatility or RSI suggests moderate risk."
    return "low", "Volatility and momentum are within normal ranges."


def _recommend(trend: str, risk_level: str, rsi: float | None) -> tuple[str, str]:
    if trend == "uptrend" and risk_level in {"low", "medium"} and (rsi is None or rsi < 70):
        return "watch / accumulate", "Trend is constructive without an overbought RSI signal."
    if trend == "downtrend" or risk_level == "high":
        return "avoid / reduce", "Weak trend or high-risk conditions warrant caution."
    return "hold / wait", "Signals are inconclusive, so waiting for confirmation is preferred."