"""Technical indicator helpers.

The helpers intentionally avoid third-party dependencies so the analyzer can run
in constrained or offline environments.
"""

from __future__ import annotations

from math import sqrt
from statistics import fmean, stdev

TRADING_DAYS_PER_YEAR = 252


def simple_moving_average(values: list[float], window: int) -> float | None:
    """Return the simple moving average for the final ``window`` values."""

    if window <= 0:
        raise ValueError("window must be greater than zero")
    if len(values) < window:
        return None
    return fmean(values[-window:])


def percent_change(start: float, end: float) -> float:
    """Return percentage change from ``start`` to ``end``."""

    if start == 0:
        raise ValueError("start value must not be zero")
    return ((end - start) / start) * 100


def relative_strength_index(values: list[float], period: int = 14) -> float | None:
    """Return the latest RSI value using simple average gains and losses."""

    if period <= 0:
        raise ValueError("period must be greater than zero")
    if len(values) <= period:
        return None

    deltas = [values[index] - values[index - 1] for index in range(1, len(values))]
    recent = deltas[-period:]
    gains = [max(delta, 0) for delta in recent]
    losses = [abs(min(delta, 0)) for delta in recent]

    average_gain = fmean(gains)
    average_loss = fmean(losses)

    if average_loss == 0:
        return 100.0

    relative_strength = average_gain / average_loss
    return 100 - (100 / (1 + relative_strength))


def annualized_volatility(values: list[float]) -> float | None:
    """Return annualized volatility percentage from closing prices."""

    if len(values) < 3:
        return None

    returns = [percent_change(values[index - 1], values[index]) / 100 for index in range(1, len(values))]
    if len(returns) < 2:
        return None

    return stdev(returns) * sqrt(TRADING_DAYS_PER_YEAR) * 100