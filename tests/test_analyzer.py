from datetime import date, timedelta

import pytest

from stock_expert_analyzer import PriceBar, analyze_prices


def make_prices(count=60, start=100.0, step=1.0):
    bars = []
    current = start
    for offset in range(count):
        current += step
        bars.append(
            PriceBar(
                date=date(2025, 1, 1) + timedelta(days=offset),
                open=current - 0.5,
                high=current + 1,
                low=current - 1,
                close=current,
                volume=1000,
            )
        )
    return bars


def test_analyze_prices_returns_constructive_signal_for_orderly_uptrend():
    result = analyze_prices("test", make_prices(step=0.5), short_window=5, long_window=20)

    assert result.symbol == "TEST"
    assert result.trend == "uptrend"
    assert result.recommendation in {"watch / accumulate", "avoid / reduce"}
    assert result.sma_short is not None
    assert result.sma_long is not None


def test_analyze_prices_rejects_too_little_history():
    with pytest.raises(ValueError, match="at least two"):
        analyze_prices("TST", make_prices(count=1))


def test_analyze_prices_requires_short_window_below_long_window():
    with pytest.raises(ValueError, match="short_window"):
        analyze_prices("TST", make_prices(), short_window=20, long_window=20)