import pytest

from stock_expert_analyzer.indicators import annualized_volatility, percent_change, relative_strength_index, simple_moving_average


def test_simple_moving_average_returns_latest_window_average():
    assert simple_moving_average([1, 2, 3, 4], 3) == pytest.approx(3)


def test_simple_moving_average_returns_none_when_history_is_short():
    assert simple_moving_average([1, 2], 3) is None


def test_percent_change():
    assert percent_change(100, 112.5) == pytest.approx(12.5)


def test_rsi_reaches_100_when_there_are_no_recent_losses():
    values = list(range(1, 20))
    assert relative_strength_index(values, period=14) == 100.0


def test_annualized_volatility_is_available_for_three_or_more_prices():
    assert annualized_volatility([100, 101, 99, 103]) is not None