import json
from pathlib import Path

import pytest

from stock_expert_analyzer.cli import main
from stock_expert_analyzer.data import load_price_bars_csv


def test_load_price_bars_csv_reads_sample_file():
    bars = load_price_bars_csv("examples/sample_prices.csv")

    assert len(bars) == 65
    assert bars[0].close > 0


def test_load_price_bars_csv_reports_missing_columns(tmp_path):
    csv_file = tmp_path / "bad.csv"
    csv_file.write_text("date,close\n2025-01-01,100\n", encoding="utf-8")

    with pytest.raises(ValueError, match="missing required columns"):
        load_price_bars_csv(csv_file)


def test_cli_outputs_json(capsys):
    exit_code = main(["SMP", "examples/sample_prices.csv", "--json"])

    assert exit_code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["symbol"] == "SMP"
    assert "recommendation" in payload