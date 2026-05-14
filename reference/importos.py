import os
import re
import json
import math
import argparse
from datetime import datetime
from typing import Dict, Any, List

import pandas as pd
import yfinance as yf
import mplfinance as mpf

from google import genai
from google.genai import types


# -----------------------------
# 유틸
# -----------------------------
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def safe_float(value, default=None):
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return default
        return float(value)
    except Exception:
        return default


def safe_int(value, default=None):
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return default
        return int(value)
    except Exception:
        return default


def extract_json_text(text: str) -> Dict[str, Any]:
    """
    모델이 JSON 외 텍스트를 섞어 반환하더라도 최대한 JSON만 추출
    """
    if not text:
        raise ValueError("Gemini 응답이 비어 있습니다.")

    text = text.strip()

    # 코드펜스 제거
    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # 바로 JSON 파싱 시도
    try:
        return json.loads(text)
    except Exception:
        pass

    # 첫 { ~ 마지막 } 추출
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end + 1]
        return json.loads(candidate)

    raise ValueError(f"JSON 파싱 실패. 원문:\n{text}")


# -----------------------------
# 지표 계산
# -----------------------------
def calculate_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()

    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()

    rs = avg_gain / avg_loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    return rsi.astype(float)


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    out["MA20"] = out["Close"].rolling(20).mean()
    out["MA60"] = out["Close"].rolling(60).mean()
    out["MA120"] = out["Close"].rolling(120).mean()

    out["RSI14"] = calculate_rsi(out["Close"], 14)
    out["VOL20"] = out["Volume"].rolling(20).mean()

    out["Prev20High"] = out["High"].rolling(20).max().shift(1)
    out["Prev60High"] = out["High"].rolling(60).max().shift(1)

    return out


def build_rule_summary(df: pd.DataFrame) -> Dict[str, Any]:
    last = df.iloc[-1]

    ma20 = safe_float(last.get("MA20"))
    ma60 = safe_float(last.get("MA60"))
    ma120 = safe_float(last.get("MA120"))
    close = safe_float(last.get("Close"))
    volume = safe_float(last.get("Volume"))
    vol20 = safe_float(last.get("VOL20"))
    rsi14 = safe_float(last.get("RSI14"))
    prev20_high = safe_float(last.get("Prev20High"))
    prev60_high = safe_float(last.get("Prev60High"))

    uptrend_alignment = (
        ma20 is not None and ma60 is not None and ma120 is not None
        and ma20 > ma60 > ma120
    )
    breakout_20d = (
        close is not None and prev20_high is not None and close > prev20_high
    )
    breakout_60d = (
        close is not None and prev60_high is not None and close > prev60_high
    )
    volume_ratio = (volume / vol20) if (volume and vol20 and vol20 != 0) else None
    volume_surge = volume_ratio is not None and volume_ratio >= 1.5

    if rsi14 is None:
        rsi_state = "unknown"
    elif rsi14 >= 70:
        rsi_state = "overbought"
    elif rsi14 <= 30:
        rsi_state = "oversold"
    else:
        rsi_state = "neutral"

    return {
        "close": close,
        "ma20": ma20,
        "ma60": ma60,
        "ma120": ma120,
        "rsi14": rsi14,
        "volume": volume,
        "vol20": vol20,
        "volume_ratio": volume_ratio,
        "prev20_high": prev20_high,
        "prev60_high": prev60_high,
        "uptrend_alignment": uptrend_alignment,
        "breakout_20d": breakout_20d,
        "breakout_60d": breakout_60d,
        "volume_surge": volume_surge,
        "rsi_state": rsi_state,
    }


# -----------------------------
# 데이터 수집
# -----------------------------
def fetch_price_data(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    df = yf.download(
        tickers=symbol,
        period=period,
        interval=interval,
        progress=False,
        auto_adjust=False,
        threads=False,
    )

    if df is None or df.empty:
        raise ValueError(f"{symbol}: 데이터가 비어 있습니다.")

    # yfinance가 컬럼 MultiIndex로 반환하는 경우 대응
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    needed = ["Open", "High", "Low", "Close", "Volume"]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise ValueError(f"{symbol}: 필요한 컬럼이 없습니다. missing={missing}")

    df = df[needed].copy()
    df.dropna(inplace=True)

    if len(df) < 140:
        raise ValueError(
            f"{symbol}: 데이터가 너무 적습니다. 최소 140개 이상 필요, 현재 {len(df)}개"
        )

    df.index = pd.to_datetime(df.index)
    return df


# -----------------------------
# 차트 생성
# -----------------------------
def save_chart_image(df: pd.DataFrame, symbol: str, out_path: str, bars: int = 180) -> None:
    plot_df = df.tail(bars).copy()

    rsi_panel = plot_df["RSI14"]
    upper = pd.Series([70] * len(plot_df), index=plot_df.index)
    lower = pd.Series([30] * len(plot_df), index=plot_df.index)

    addplots = [
        mpf.make_addplot(rsi_panel, panel=2, color="purple", ylabel="RSI(14)"),
        mpf.make_addplot(upper, panel=2, color="red", linestyle="--"),
        mpf.make_addplot(lower, panel=2, color="green", linestyle="--"),
    ]

    title = f"{symbol} | Candlestick + MA20/60/120 + Volume + RSI14"

    mpf.plot(
        plot_df,
        type="candle",
        style="charles",
        mav=(20, 60, 120),
        volume=True,
        addplot=addplots,
        panel_ratios=(6, 2, 2),
        title=title,
        ylabel="Price",
        ylabel_lower="Volume",
        figscale=1.2,
        figratio=(16, 10),
        xrotation=15,
        tight_layout=True,
        warn_too_much_data=10000,
        savefig=dict(fname=out_path, dpi=160, bbox_inches="tight"),
    )


# -----------------------------
# Gemini 분석
# -----------------------------
def build_analysis_prompt(symbol: str, summary: Dict[str, Any]) -> str:
    return f"""
너는 주식 차트 기술적 분석 보조 엔진이다.
입력된 차트 이미지를 보고, 아래 수치 요약과 함께 종합 판단하라.
반드시 JSON 객체만 출력하라. 마크다운, 설명문, 코드펜스는 절대 출력하지 마라.

[종목]
{symbol}

[수치 요약]
- 종가: {summary.get("close")}
- MA20: {summary.get("ma20")}
- MA60: {summary.get("ma60")}
- MA120: {summary.get("ma120")}
- RSI14: {summary.get("rsi14")}
- 거래량: {summary.get("volume")}
- 20일 평균 거래량: {summary.get("vol20")}
- 거래량 배수: {summary.get("volume_ratio")}
- 직전 20일 고가: {summary.get("prev20_high")}
- 직전 60일 고가: {summary.get("prev60_high")}
- 정배열 여부(규칙 계산): {summary.get("uptrend_alignment")}
- 20일 돌파 여부(규칙 계산): {summary.get("breakout_20d")}
- 60일 돌파 여부(규칙 계산): {summary.get("breakout_60d")}
- 거래량 급증 여부(규칙 계산): {summary.get("volume_surge")}
- RSI 상태(규칙 계산): {summary.get("rsi_state")}

[판단 규칙]
1. 차트 이미지와 수치 요약이 충돌하면, 충돌 사실을 risk_flags에 기록하라.
2. comment는 한국어 120자 이내.
3. confidence는 0~100 정수.
4. action은 아래 셋 중 하나만 사용:
   - buy_watch
   - hold
   - avoid
5. trend_strength는 0~100 정수.
6. pattern_tags는 최대 5개까지 한국어 문자열 배열.

[반드시 아래 스키마 형태로만 출력]
{{
  "symbol": "{symbol}",
  "uptrend_alignment": true,
  "breakout": false,
  "volume_surge": false,
  "rsi_state": "neutral",
  "action": "buy_watch",
  "trend_strength": 67,
  "confidence": 73,
  "pattern_tags": ["정배열", "박스돌파시도"],
  "risk_flags": ["직전고점 저항"],
  "comment": "20·60·120일선이 우상향이며 거래량 확인 후 추세 지속 여부를 볼 만합니다."
}}
""".strip()


def analyze_chart_with_gemini(
    client: genai.Client,
    model_name: str,
    image_path: str,
    symbol: str,
    summary: Dict[str, Any],
) -> Dict[str, Any]:
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    prompt = build_analysis_prompt(symbol, summary)

    response = client.models.generate_content(
        model=model_name,
        contents=[
            prompt,
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/png",
            ),
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
        ),
    )

    parsed = extract_json_text(response.text)

    # 최소 후처리
    parsed.setdefault("symbol", symbol)
    parsed.setdefault("uptrend_alignment", summary.get("uptrend_alignment"))
    parsed.setdefault("volume_surge", summary.get("volume_surge"))
    parsed.setdefault("rsi_state", summary.get("rsi_state"))
    parsed.setdefault("action", "hold")
    parsed.setdefault("trend_strength", 50)
    parsed.setdefault("confidence", 50)
    parsed.setdefault("pattern_tags", [])
    parsed.setdefault("risk_flags", [])
    parsed.setdefault("comment", "")

    return parsed


# -----------------------------
# 저장
# -----------------------------
def save_json(data: Dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def result_row(
    symbol: str,
    chart_path: str,
    raw_summary: Dict[str, Any],
    ai_result: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "symbol": symbol,
        "close": raw_summary.get("close"),
        "ma20": raw_summary.get("ma20"),
        "ma60": raw_summary.get("ma60"),
        "ma120": raw_summary.get("ma120"),
        "rsi14": raw_summary.get("rsi14"),
        "volume": raw_summary.get("volume"),
        "vol20": raw_summary.get("vol20"),
        "volume_ratio": raw_summary.get("volume_ratio"),
        "rule_uptrend_alignment": raw_summary.get("uptrend_alignment"),
        "rule_breakout_20d": raw_summary.get("breakout_20d"),
        "rule_breakout_60d": raw_summary.get("breakout_60d"),
        "rule_volume_surge": raw_summary.get("volume_surge"),
        "rule_rsi_state": raw_summary.get("rsi_state"),
        "ai_uptrend_alignment": ai_result.get("uptrend_alignment"),
        "ai_breakout": ai_result.get("breakout"),
        "ai_volume_surge": ai_result.get("volume_surge"),
        "ai_rsi_state": ai_result.get("rsi_state"),
        "ai_action": ai_result.get("action"),
        "ai_trend_strength": ai_result.get("trend_strength"),
        "ai_confidence": ai_result.get("confidence"),
        "ai_pattern_tags": ", ".join(ai_result.get("pattern_tags", [])),
        "ai_risk_flags": ", ".join(ai_result.get("risk_flags", [])),
        "ai_comment": ai_result.get("comment"),
        "chart_path": chart_path,
    }


# -----------------------------
# 메인 처리
# -----------------------------
def process_symbol(
    client: genai.Client,
    model_name: str,
    symbol: str,
    output_dir: str,
    period: str,
    interval: str,
    bars: int,
) -> Dict[str, Any]:
    print(f"[+] 처리 시작: {symbol}")

    symbol_dir = os.path.join(output_dir, symbol.replace("/", "_"))
    ensure_dir(symbol_dir)

    # 1) 데이터 수집
    df = fetch_price_data(symbol, period=period, interval=interval)
    df = add_indicators(df)

    # 2) 규칙 요약
    summary = build_rule_summary(df)

    # 3) 차트 저장
    chart_path = os.path.join(symbol_dir, f"{symbol}_chart.png")
    save_chart_image(df, symbol, chart_path, bars=bars)

    # 4) Gemini 분석
    ai_result = analyze_chart_with_gemini(
        client=client,
        model_name=model_name,
        image_path=chart_path,
        symbol=symbol,
        summary=summary,
    )

    # 5) JSON 저장
    json_path = os.path.join(symbol_dir, f"{symbol}_analysis.json")
    payload = {
        "symbol": symbol,
        "generated_at": datetime.now().isoformat(),
        "summary": summary,
        "ai_result": ai_result,
        "chart_path": chart_path,
    }
    save_json(payload, json_path)

    # 6) 반환용 row
    row = result_row(symbol, chart_path, summary, ai_result)
    print(f"[✓] 완료: {symbol}")
    return row


def parse_args():
    parser = argparse.ArgumentParser(
        description="주식 차트 생성 + Gemini 분석 + CSV/JSON 저장"
    )
    parser.add_argument(
        "--symbols",
        nargs="+",
        required=True,
        help="분석할 티커 목록 예: AAPL MSFT NVDA 005930.KS",
    )
    parser.add_argument(
        "--period",
        default="1y",
        help="yfinance period 예: 6mo, 1y, 2y",
    )
    parser.add_argument(
        "--interval",
        default="1d",
        help="yfinance interval 예: 1d, 1wk",
    )
    parser.add_argument(
        "--bars",
        type=int,
        default=180,
        help="차트에 표시할 최근 봉 개수",
    )
    parser.add_argument(
        "--output",
        default="output",
        help="출력 폴더",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        help="Gemini 모델명. 예: gemini-2.5-flash",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    ensure_dir(args.output)

    client = genai.Client(api_key=api_key)

    all_rows: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []

    for symbol in args.symbols:
        try:
            row = process_symbol(
                client=client,
                model_name=args.model,
                symbol=symbol,
                output_dir=args.output,
                period=args.period,
                interval=args.interval,
                bars=args.bars,
            )
            all_rows.append(row)
        except Exception as e:
            print(f"[!] 실패: {symbol} -> {e}")
            errors.append({"symbol": symbol, "error": str(e)})

    # CSV 저장
    if all_rows:
        df_out = pd.DataFrame(all_rows)
        csv_path = os.path.join(args.output, "analysis_results.csv")
        df_out.to_csv(csv_path, index=False, encoding="utf-8-sig")
        print(f"\n[CSV 저장 완료] {csv_path}")

    # 에러 로그 저장
    if errors:
        err_path = os.path.join(args.output, "errors.json")
        save_json({"errors": errors}, err_path)
        print(f"[에러 로그 저장] {err_path}")

    print("\n모든 작업이 종료되었습니다.")


if __name__ == "__main__":
    main()
