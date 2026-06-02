import type { IncomingMessage, ServerResponse } from "node:http";

type Market = "KOSPI" | "KOSDAQ";
type ProviderState = "connected" | "missing_key" | "fallback" | "error";

type ProviderStatus = {
  id: "price" | "disclosure" | "news";
  label: string;
  state: ProviderState;
  detail: string;
  requiredEnv?: string[];
};

type MarketIndex = {
  name: Market;
  value: number;
  changePct: number;
  turnoverTn: number;
  advancers: number;
  decliners: number;
};

type StrengthItem = {
  name: string;
  changePct: number;
  strength: number;
  flow: string;
  lead: string;
};

type StockSignal = {
  code: string;
  name: string;
  market: Market;
  sector: string;
  theme: string;
  changePct: number;
  volumeRatio: number;
  turnoverBn: number;
  foreignNetBn: number;
  institutionNetBn: number;
  programNetBn: number;
  news: string;
  disclosure: string;
  trendScore: number;
  themeRank: number;
  sectorRank: number;
  riskTags: string[];
  earlySignal: boolean;
};

type MarketSnapshot = {
  asOf: string;
  source: "sample" | "yahoo" | "naver";
  sourceDetail: string;
  providers: ProviderStatus[];
  marketSummary: string;
  briefing: string;
  indices: MarketIndex[];
  themes: StrengthItem[];
  sectors: StrengthItem[];
  stocks: StockSignal[];
  scoreModel: Array<{ label: string; max: number; rule: string }>;
};

type CachedSnapshot = {
  expiresAt: number;
  snapshot: MarketSnapshot;
};

type DartDisclosure = {
  corp_name?: string;
  report_nm?: string;
  rcept_dt?: string;
};

type NaverNewsItem = {
  title?: string;
  description?: string;
  pubDate?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        regularMarketVolume?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

type YahooMarketData = {
  source: "yahoo" | "naver";
  status: ProviderStatus;
  asOf: string;
  indices: Array<Pick<MarketIndex, "name" | "value" | "changePct">>;
  stocks: StockSignal[];
};

type NaverRealtimeResponse = {
  resultCode?: string;
  result?: {
    time?: number;
    areas?: Array<{
      name?: string;
      datas?: NaverRealtimeData[];
    }>;
  };
};

type NaverRealtimeData = {
  cd?: string;
  nm?: string;
  nv?: number;
  pcv?: number;
  cr?: number;
  rf?: string;
  aq?: number;
  aa?: number;
};

const YAHOO_STOCK_SYMBOLS: Record<string, string> = {
  "000660": "000660.KS",
  "058470": "058470.KQ",
  "267260": "267260.KS",
  "066970": "066970.KS",
  "196170": "196170.KQ",
  "047810": "047810.KS",
  "035420": "035420.KS",
  "034020": "034020.KS",
};

let cachedSnapshot: CachedSnapshot | undefined;

function provider(
  id: ProviderStatus["id"],
  label: string,
  state: ProviderState,
  detail: string,
  requiredEnv?: string[],
): ProviderStatus {
  return { id, label, state, detail, requiredEnv };
}

async function buildSnapshot(): Promise<MarketSnapshot> {
  const base = getBaseSnapshot();
  const [marketResult, disclosureResult, newsResult] = await Promise.allSettled([
    fetchNaverMarket(base.stocks).catch(() => fetchYahooMarket(base.stocks)),
    fetchDartDisclosures(base.stocks),
    fetchNaverNews(base.stocks),
  ]);

  let snapshot = base;

  if (marketResult.status === "fulfilled") {
    snapshot = applyYahooMarket(snapshot, marketResult.value);
    snapshot = upsertProvider(snapshot, marketResult.value.status);
  } else {
    snapshot = upsertProvider(
      snapshot,
      provider("price", "시세", "fallback", "네이버/Yahoo 시세 조회에 실패해 내장 샘플 지수와 종목 데이터를 표시합니다."),
    );
  }

  if (disclosureResult.status === "fulfilled") {
    snapshot = applyDisclosures(snapshot, disclosureResult.value.disclosures);
    snapshot = upsertProvider(snapshot, disclosureResult.value.status);
  } else {
    snapshot = upsertProvider(
      snapshot,
      provider("disclosure", "공시", "error", "DART 공시 API 호출에 실패해 기본 공시 문구를 표시합니다.", ["DART_API_KEY"]),
    );
  }

  if (newsResult.status === "fulfilled") {
    snapshot = applyNews(snapshot, newsResult.value.newsByStock);
    snapshot = upsertProvider(snapshot, newsResult.value.status);
  } else {
    snapshot = upsertProvider(
      snapshot,
      provider("news", "뉴스", "error", "네이버 뉴스 API 호출에 실패해 기본 뉴스 문구를 표시합니다.", ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]),
    );
  }

  return {
    ...snapshot,
    sourceDetail: snapshot.providers.map((item) => `${item.label}: ${item.detail}`).join(" "),
  };
}

function getBaseSnapshot(): MarketSnapshot {
  const indices = [
    { name: "KOSPI" as const, value: 2792.41, changePct: 0.82, turnoverTn: 9.8, advancers: 512, decliners: 358 },
    { name: "KOSDAQ" as const, value: 874.26, changePct: 1.47, turnoverTn: 7.1, advancers: 827, decliners: 514 },
  ];

  const themes = [
    { name: "AI 반도체", changePct: 4.8, strength: 92, flow: "외국인·기관 동시 유입", lead: "SK하이닉스, 리노공업" },
    { name: "전력기기", changePct: 3.9, strength: 86, flow: "기관 3일 순매수", lead: "HD현대일렉트릭" },
    { name: "2차전지 장비", changePct: 3.3, strength: 80, flow: "거래대금 회복", lead: "엘앤에프" },
    { name: "바이오 임상", changePct: 2.9, strength: 76, flow: "공시·뉴스 동반", lead: "알테오젠" },
    { name: "방산", changePct: 2.4, strength: 71, flow: "수주 기대", lead: "한국항공우주" },
  ];

  const sectors = [
    { name: "반도체", changePct: 3.6, strength: 90, flow: "대형주와 소부장 동반 상승", lead: "SK하이닉스, 리노공업" },
    { name: "전기장비", changePct: 3.1, strength: 84, flow: "기관 수급 우위", lead: "HD현대일렉트릭" },
    { name: "제약·바이오", changePct: 2.6, strength: 77, flow: "임상 이벤트 기대", lead: "알테오젠" },
    { name: "기계", changePct: 2.1, strength: 70, flow: "수출·수주 모멘텀", lead: "두산에너빌리티" },
    { name: "소프트웨어", changePct: 1.8, strength: 66, flow: "AI 서비스 확산", lead: "NAVER" },
  ];

  const stocks: StockSignal[] = [
    { code: "000660", name: "SK하이닉스", market: "KOSPI", sector: "반도체", theme: "AI 반도체", changePct: 5.42, volumeRatio: 2.4, turnoverBn: 12850, foreignNetBn: 1820, institutionNetBn: 690, programNetBn: 410, news: "HBM 공급 확대 기대", disclosure: "최근 공시 확인 전", trendScore: 18, themeRank: 1, sectorRank: 1, riskTags: ["단기 급등"], earlySignal: false },
    { code: "058470", name: "리노공업", market: "KOSDAQ", sector: "반도체", theme: "AI 반도체", changePct: 4.18, volumeRatio: 2.1, turnoverBn: 1420, foreignNetBn: 210, institutionNetBn: 130, programNetBn: 48, news: "AI 테스트 소켓 수요", disclosure: "최근 공시 확인 전", trendScore: 17, themeRank: 1, sectorRank: 1, riskTags: [], earlySignal: false },
    { code: "267260", name: "HD현대일렉트릭", market: "KOSPI", sector: "전기장비", theme: "전력기기", changePct: 3.72, volumeRatio: 1.9, turnoverBn: 3380, foreignNetBn: 95, institutionNetBn: 340, programNetBn: 62, news: "북미 전력망 투자 기대", disclosure: "최근 공시 확인 전", trendScore: 18, themeRank: 2, sectorRank: 2, riskTags: [], earlySignal: false },
    { code: "066970", name: "엘앤에프", market: "KOSPI", sector: "2차전지", theme: "2차전지 장비", changePct: 2.12, volumeRatio: 1.7, turnoverBn: 980, foreignNetBn: 74, institutionNetBn: 54, programNetBn: 18, news: "배터리 소재 업황 저점 기대", disclosure: "최근 공시 확인 전", trendScore: 12, themeRank: 3, sectorRank: 4, riskTags: ["업황 변동성"], earlySignal: true },
    { code: "196170", name: "알테오젠", market: "KOSDAQ", sector: "제약·바이오", theme: "바이오 임상", changePct: 3.05, volumeRatio: 1.8, turnoverBn: 2210, foreignNetBn: 160, institutionNetBn: -42, programNetBn: 30, news: "기술이전 기대감", disclosure: "최근 공시 확인 전", trendScore: 15, themeRank: 4, sectorRank: 3, riskTags: ["이벤트 변동성"], earlySignal: true },
    { code: "047810", name: "한국항공우주", market: "KOSPI", sector: "방산", theme: "방산", changePct: 1.62, volumeRatio: 1.5, turnoverBn: 760, foreignNetBn: -18, institutionNetBn: 88, programNetBn: 12, news: "수출 협상 보도", disclosure: "최근 공시 확인 전", trendScore: 11, themeRank: 5, sectorRank: 5, riskTags: [], earlySignal: true },
    { code: "035420", name: "NAVER", market: "KOSPI", sector: "소프트웨어", theme: "AI 서비스", changePct: 0.86, volumeRatio: 1.35, turnoverBn: 1140, foreignNetBn: 122, institutionNetBn: 45, programNetBn: 39, news: "AI 검색 서비스 개편", disclosure: "최근 공시 확인 전", trendScore: 9, themeRank: 6, sectorRank: 5, riskTags: ["추세 확인 필요"], earlySignal: true },
    { code: "034020", name: "두산에너빌리티", market: "KOSPI", sector: "기계", theme: "원전·전력", changePct: -0.28, volumeRatio: 1.22, turnoverBn: 890, foreignNetBn: 66, institutionNetBn: 31, programNetBn: 9, news: "원전 수주 기대 보도", disclosure: "최근 공시 확인 전", trendScore: 7, themeRank: 7, sectorRank: 4, riskTags: ["가격 모멘텀 약함"], earlySignal: true },
  ];

  const providers = [
    provider("price", "시세", "fallback", "공개 배포에서는 안정적인 샘플 시세를 사용합니다. 다음 단계에서 유료/공식 시세 공급자를 붙일 수 있습니다."),
    provider("disclosure", "공시", "fallback", "DART 최근 공시를 확인 중입니다.", ["DART_API_KEY"]),
    provider("news", "뉴스", "fallback", "네이버 뉴스 검색 결과를 확인 중입니다.", ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]),
  ];

  return {
    asOf: new Date().toISOString(),
    source: "sample",
    sourceDetail: providers.map((item) => `${item.label}: ${item.detail}`).join(" "),
    providers,
    marketSummary: "코스닥 강도가 우세하고 AI 반도체·전력기기에 수급과 거래대금이 집중됩니다.",
    briefing: "오늘 시장은 코스닥 강도가 코스피보다 우세하며, AI 반도체와 전력기기에 수급과 거래대금이 집중됩니다. 뉴스와 공시는 외부 API로 보강하며, 단기 급등 종목은 분할 접근과 손절 기준을 먼저 정해야 합니다.",
    indices,
    themes,
    sectors,
    stocks,
    scoreModel: [
      { label: "수급 점수", max: 20, rule: "외국인·기관 3일 순매수, 프로그램 순매수 우위" },
      { label: "거래량 점수", max: 15, rule: "5일·20일 평균 대비 거래량 증가 배수" },
      { label: "거래대금 점수", max: 10, rule: "시장 관심을 확인할 수 있는 절대 거래대금" },
      { label: "뉴스 모멘텀", max: 10, rule: "긍정 뉴스, 정책, 수주, 실적 기대 키워드" },
      { label: "공시 모멘텀", max: 10, rule: "수주, 계약, 실적, 임상, 자사주, M&A 공시" },
      { label: "테마 강도", max: 10, rule: "테마 내 상대강도와 동반 상승 종목 수" },
      { label: "업종 강도", max: 10, rule: "업종 수익률과 업종 내 주도주 확산" },
      { label: "추세 점수", max: 15, rule: "단기·중기 추세, 신고가, 눌림 후 재상승" },
      { label: "리스크 감점", max: -20, rule: "단기 과열, 관리종목, 투자주의, 공시 불확실성" },
    ],
  };
}

async function fetchYahooMarket(baseStocks: StockSignal[]): Promise<YahooMarketData> {
  const [kospi, kosdaq, liveStocks] = await Promise.all([
    fetchYahooIndex("KOSPI", "^KS11"),
    fetchYahooIndex("KOSDAQ", "^KQ11"),
    fetchYahooStocks(baseStocks),
  ]);

  const asOfTime = Math.max(
    kospi.regularMarketTime ?? 0,
    kosdaq.regularMarketTime ?? 0,
    ...liveStocks.map((stock) => stock.regularMarketTime ?? 0),
  );

  return {
    source: "yahoo",
    status: provider("price", "시세", "connected", "Yahoo Finance chart 지연 시세로 지수, 종목 등락률, 거래량, 거래대금을 갱신했습니다."),
    asOf: asOfTime > 0 ? new Date(asOfTime * 1000).toISOString() : new Date().toISOString(),
    indices: [
      { name: "KOSPI" as const, value: kospi.value, changePct: kospi.changePct },
      { name: "KOSDAQ" as const, value: kosdaq.value, changePct: kosdaq.changePct },
    ],
    stocks: liveStocks.map(({ regularMarketTime, ...stock }) => stock),
  };
}

async function fetchNaverMarket(baseStocks: StockSignal[]): Promise<YahooMarketData> {
  const [kospi, kosdaq, liveStocks] = await Promise.all([
    fetchNaverIndex("KOSPI"),
    fetchNaverIndex("KOSDAQ"),
    Promise.all(baseStocks.map(fetchNaverStock)),
  ]);
  const asOfTime = Math.max(
    kospi.asOfTime,
    kosdaq.asOfTime,
    ...liveStocks.map((stock) => stock.regularMarketTime ?? 0),
  );

  return {
    source: "naver",
    status: provider("price", "시세", "connected", "네이버 금융 realtime 시세로 지수, 종목 등락률, 거래량, 거래대금을 갱신했습니다."),
    asOf: asOfTime > 0 ? new Date(asOfTime).toISOString() : new Date().toISOString(),
    indices: [
      { name: "KOSPI" as const, value: kospi.value, changePct: kospi.changePct },
      { name: "KOSDAQ" as const, value: kosdaq.value, changePct: kosdaq.changePct },
    ],
    stocks: liveStocks.map(({ regularMarketTime, ...stock }) => stock),
  };
}

async function fetchNaverIndex(name: Market) {
  const data = await fetchNaverRealtime(`SERVICE_INDEX:${name}`);
  const item = data.result?.areas?.find((area) => area.name === "SERVICE_INDEX")?.datas?.[0];
  const value = item?.nv;
  const changePct = signedNaverRate(item);

  if (typeof value !== "number" || typeof changePct !== "number") {
    throw new Error(`${name} Naver index data is incomplete`);
  }

  return {
    value: value / 100,
    changePct,
    asOfTime: data.result?.time ?? 0,
  };
}

async function fetchNaverStock(stock: StockSignal) {
  try {
    const data = await fetchNaverRealtime(`SERVICE_ITEM:${stock.code}`);
    const item = data.result?.areas?.find((area) => area.name === "SERVICE_ITEM")?.datas?.[0];
    const value = item?.nv;
    const changePct = signedNaverRate(item);

    if (typeof value !== "number" || typeof changePct !== "number") {
      throw new Error(`${stock.code} Naver stock data is incomplete`);
    }

    const currentVolume = item?.aq ?? 0;
    const averageVolume = await fetchYahooAverageVolume(stock).catch(() => 0);
    const sessionProgress = getKoreanSessionProgress(data.result?.time ? Math.floor(data.result.time / 1000) : undefined);
    const expectedVolumeSoFar = averageVolume * sessionProgress;
    const volumeRatio = expectedVolumeSoFar > 0 ? currentVolume / expectedVolumeSoFar : stock.volumeRatio;
    const turnoverBn = typeof item?.aa === "number" ? item.aa / 100_000_000 : stock.turnoverBn;
    const trendScore = Math.max(1, Math.min(20, Math.round(8 + changePct * 1.8 + Math.min(volumeRatio, 3) * 3)));

    return {
      ...stock,
      changePct,
      volumeRatio,
      turnoverBn,
      trendScore,
      riskTags: getLiveRiskTags(stock, changePct, volumeRatio),
      earlySignal: stock.earlySignal || changePct > 0 || volumeRatio >= 1.2,
      regularMarketTime: data.result?.time ?? 0,
    };
  } catch {
    return { ...stock, regularMarketTime: 0 };
  }
}

async function fetchNaverRealtime(query: string) {
  const url = new URL("https://polling.finance.naver.com/api/realtime");
  url.searchParams.set("query", query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Naver realtime responded with ${response.status}`);
    }

    const body = await response.json() as NaverRealtimeResponse;

    if (body.resultCode !== "success") {
      throw new Error("Naver realtime API error");
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

function signedNaverRate(item?: NaverRealtimeData) {
  if (typeof item?.cr !== "number") return undefined;
  const sign = item.rf === "4" || item.rf === "5" ? -1 : 1;
  return item.rf === "3" ? 0 : item.cr * sign;
}

async function fetchYahooIndex(name: Market, symbol: string) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");

  const body = await fetchJson<YahooChartResponse>(url, 4_000);
  const meta = body.chart?.result?.[0]?.meta;
  const value = meta?.regularMarketPrice;
  const previousClose = meta?.previousClose ?? meta?.chartPreviousClose;

  if (typeof value !== "number" || typeof previousClose !== "number" || previousClose === 0) {
    throw new Error(`${name} Yahoo chart data is incomplete`);
  }

  return {
    value,
    changePct: ((value - previousClose) / previousClose) * 100,
    regularMarketTime: meta?.regularMarketTime,
  };
}

async function fetchYahooStocks(baseStocks: StockSignal[]) {
  return Promise.all(baseStocks.map(fetchYahooStock));
}

async function fetchYahooAverageVolume(stock: StockSignal) {
  const symbol = YAHOO_STOCK_SYMBOLS[stock.code];
  if (!symbol) return 0;

  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");

  const body = await fetchJson<YahooChartResponse>(url, 4_000);
  const quote = body.chart?.result?.[0]?.indicators?.quote?.[0];
  const volumes = compactNumbers(quote?.volume ?? []);
  const previousVolumes = volumes.length > 1 ? volumes.slice(0, -1) : volumes;

  return average(previousVolumes);
}

async function fetchYahooStock(stock: StockSignal) {
  try {
    const symbol = YAHOO_STOCK_SYMBOLS[stock.code];
    if (!symbol) return { ...stock, regularMarketTime: 0 };

    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set("range", "5d");
    url.searchParams.set("interval", "1d");

    const body = await fetchJson<YahooChartResponse>(url, 4_000);
    const result = body.chart?.result?.[0];
    const meta = result?.meta;
    const quote = result?.indicators?.quote?.[0];
    const closes = compactNumbers(quote?.close ?? []);
    const volumes = compactNumbers(quote?.volume ?? []);
    const value = meta?.regularMarketPrice ?? closes.at(-1);
    const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? closes.at(-2);

    if (typeof value !== "number" || typeof previousClose !== "number" || previousClose === 0) {
      return { ...stock, regularMarketTime: meta?.regularMarketTime ?? 0 };
    }

    const currentVolume = meta?.regularMarketVolume ?? volumes.at(-1) ?? 0;
    const previousVolumes = volumes.length > 1 ? volumes.slice(0, -1) : volumes;
    const averageVolume = average(previousVolumes);
    const sessionProgress = getKoreanSessionProgress(meta?.regularMarketTime);
    const expectedVolumeSoFar = averageVolume * sessionProgress;
    const volumeRatio = expectedVolumeSoFar > 0 ? currentVolume / expectedVolumeSoFar : stock.volumeRatio;
    const changePct = ((value - previousClose) / previousClose) * 100;
    const turnoverBn = currentVolume > 0 ? (value * currentVolume) / 100_000_000 : stock.turnoverBn;
    const trendScore = Math.max(1, Math.min(20, Math.round(8 + changePct * 1.8 + Math.min(volumeRatio, 3) * 3)));

    return {
      ...stock,
      changePct,
      volumeRatio,
      turnoverBn,
      trendScore,
      riskTags: getLiveRiskTags(stock, changePct, volumeRatio),
      earlySignal: stock.earlySignal || changePct > 0 || volumeRatio >= 1.2,
      regularMarketTime: meta?.regularMarketTime ?? 0,
    };
  } catch {
    return { ...stock, regularMarketTime: 0 };
  }
}

function applyYahooMarket(snapshot: MarketSnapshot, marketData: YahooMarketData): MarketSnapshot {
  const indices = snapshot.indices.map((index) => {
    const live = marketData.indices.find((item) => item.name === index.name);
    if (!live) return index;

    return {
      ...index,
      value: live.value,
      changePct: live.changePct,
    };
  });
  const themes = deriveStrengthItems(marketData.stocks, "theme");
  const sectors = deriveStrengthItems(marketData.stocks, "sector");
  const stocks = applyStrengthRanks(marketData.stocks, themes, sectors);
  const marketSummary = buildMarketSummary(indices, themes);

  return {
    ...snapshot,
    asOf: marketData.asOf,
    source: marketData.source,
    marketSummary,
    briefing: `${marketSummary} 종목 등락률, 거래량, 거래대금은 Yahoo Finance 지연 시세를 반영했고 수급·뉴스·공시는 보강 데이터로 함께 계산했습니다.`,
    indices,
    themes,
    sectors,
    stocks,
  };
}

function buildMarketSummary(indices: MarketIndex[], themes: StrengthItem[]) {
  const kospi = indices.find((index) => index.name === "KOSPI");
  const kosdaq = indices.find((index) => index.name === "KOSDAQ");
  const leadingThemes = themes.slice(0, 2).map((theme) => theme.name).join("·");

  if (!kospi || !kosdaq) {
    return "KOSPI/KOSDAQ 지수 데이터 일부가 제한되어 시장 방향을 보수적으로 표시합니다.";
  }

  const leader = kospi.changePct >= kosdaq.changePct ? kospi : kosdaq;
  const direction = leader.changePct >= 0 ? "상승률" : "방어력";

  return `${leader.name}의 ${direction}이 상대적으로 우세합니다. KOSPI ${formatPercent(kospi.changePct)}, KOSDAQ ${formatPercent(kosdaq.changePct)} 기준이며, 관심군에서는 ${leadingThemes || "주요 테마"} 순서로 상대 강도가 높습니다.`;
}

function deriveStrengthItems(stockList: StockSignal[], key: "theme" | "sector"): StrengthItem[] {
  const grouped = new Map<string, StockSignal[]>();

  for (const stock of stockList) {
    const groupName = stock[key];
    grouped.set(groupName, [...(grouped.get(groupName) ?? []), stock]);
  }

  return Array.from(grouped.entries())
    .map(([name, members]) => {
      const averageChange = average(members.map((stock) => stock.changePct));
      const averageVolumeRatio = average(members.map((stock) => stock.volumeRatio));
      const positiveCount = members.filter((stock) => stock.changePct >= 0).length;
      const strength = Math.max(1, Math.min(100, Math.round(50 + averageChange * 7 + averageVolumeRatio * 8 + (positiveCount / members.length) * 12)));
      const lead = members
        .slice()
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, 2)
        .map((stock) => stock.name)
        .join(", ");

      return {
        name,
        changePct: averageChange,
        strength,
        flow: `상승 ${positiveCount}/${members.length}, 평균 거래량 ${averageVolumeRatio.toFixed(1)}배`,
        lead,
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

function applyStrengthRanks(stocks: StockSignal[], themes: StrengthItem[], sectors: StrengthItem[]) {
  const themeRank = new Map(themes.map((theme, index) => [theme.name, index + 1]));
  const sectorRank = new Map(sectors.map((sector, index) => [sector.name, index + 1]));

  return stocks.map((stock) => ({
    ...stock,
    themeRank: themeRank.get(stock.theme) ?? stock.themeRank,
    sectorRank: sectorRank.get(stock.sector) ?? stock.sectorRank,
  }));
}

function getLiveRiskTags(stock: StockSignal, changePct: number, volumeRatio: number) {
  const tags = stock.riskTags.filter((tag) => !["단기 급등", "가격 약세", "거래량 과열", "추세 확인 필요"].includes(tag));

  if (changePct >= 5) tags.push("단기 급등");
  if (changePct <= -3) tags.push("가격 약세");
  if (volumeRatio >= 2.5) tags.push("거래량 과열");
  if (changePct < 0 && volumeRatio < 1) tags.push("추세 확인 필요");

  return Array.from(new Set(tags));
}

function getKoreanSessionProgress(timestamp?: number) {
  if (!timestamp) return 1;

  const marketTime = new Date(timestamp * 1000);
  const minutes = marketTime.getUTCHours() * 60 + marketTime.getUTCMinutes() + 9 * 60;
  const kstMinutes = minutes % (24 * 60);
  const open = 9 * 60;
  const close = 15 * 60 + 30;

  if (kstMinutes <= open) return 0.05;
  if (kstMinutes >= close) return 1;

  return Math.max(0.05, Math.min(1, (kstMinutes - open) / (close - open)));
}

async function fetchDartDisclosures(stockList: StockSignal[]) {
  const apiKey = process.env.DART_API_KEY?.trim();

  if (!apiKey) {
    return {
      status: provider("disclosure", "공시", "missing_key", "DART_API_KEY가 없어 공시 자동 보강을 건너뜁니다.", ["DART_API_KEY"]),
      disclosures: [] as DartDisclosure[],
    };
  }

  const url = new URL("https://opendart.fss.or.kr/api/list.json");
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("bgn_de", getKstYmd(-14));
  url.searchParams.set("end_de", getKstYmd(0));
  url.searchParams.set("page_no", "1");
  url.searchParams.set("page_count", "100");
  url.searchParams.set("sort", "date");
  url.searchParams.set("sort_mth", "desc");

  const body = await fetchJson<{ status?: string; message?: string; list?: DartDisclosure[] }>(url, 4_000);

  if (body.status && body.status !== "000" && body.status !== "013") {
    throw new Error(body.message || "DART API error");
  }

  const disclosures = body.list ?? [];
  const stockNames = new Set(stockList.map((stock) => stock.name));
  const matchedCount = disclosures.filter((item) => item.corp_name && stockNames.has(item.corp_name)).length;

  return {
    status: provider("disclosure", "공시", "connected", `DART 최근 14일 공시를 연결했습니다. 관심 종목 관련 ${matchedCount}건을 반영했습니다.`),
    disclosures,
  };
}

async function fetchNaverNews(stockList: StockSignal[]) {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return {
      status: provider("news", "뉴스", "missing_key", "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 없어 뉴스 자동 보강을 건너뜁니다.", ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]),
      newsByStock: new Map<string, NaverNewsItem[]>(),
    };
  }

  const pairs = await Promise.all(stockList.map(async (stock) => {
    const url = new URL("https://openapi.naver.com/v1/search/news.json");
    url.searchParams.set("query", `${stock.name}`);
    url.searchParams.set("display", "3");
    url.searchParams.set("sort", "date");

    const body = await fetchJson<{ items?: NaverNewsItem[] }>(url, 4_000, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    const relevantItems = (body.items ?? [])
      .filter((item) => isRelevantNews(stock, item))
      .slice(0, 3);

    return [stock.code, relevantItems] as const;
  }));

  const newsByStock = new Map(pairs);
  const matchedCount = Array.from(newsByStock.values()).filter((items) => items.length > 0).length;

  return {
    status: provider("news", "뉴스", "connected", `네이버 뉴스 검색 API를 연결했습니다. 관심 종목 ${matchedCount}개에 최신 뉴스가 반영됐습니다.`),
    newsByStock,
  };
}

function applyDisclosures(snapshot: MarketSnapshot, disclosures: DartDisclosure[]): MarketSnapshot {
  if (disclosures.length === 0) return snapshot;

  const disclosureByName = new Map<string, DartDisclosure>();

  for (const disclosure of disclosures) {
    if (disclosure.corp_name && !disclosureByName.has(disclosure.corp_name)) {
      disclosureByName.set(disclosure.corp_name, disclosure);
    }
  }

  return {
    ...snapshot,
    stocks: snapshot.stocks.map((stock) => {
      const hit = disclosureByName.get(stock.name);
      if (!hit?.report_nm) return stock;

      return {
        ...stock,
        disclosure: `${hit.report_nm}${hit.rcept_dt ? ` (${formatDisclosureDate(hit.rcept_dt)})` : ""}`,
        earlySignal: true,
      };
    }),
  };
}

function applyNews(snapshot: MarketSnapshot, newsByStock: Map<string, NaverNewsItem[]>): MarketSnapshot {
  if (newsByStock.size === 0) return snapshot;

  return {
    ...snapshot,
    stocks: snapshot.stocks.map((stock) => {
      const first = newsByStock.get(stock.code)?.[0];
      const title = stripHtml(first?.title ?? "");

      if (!title) return stock;

      return {
        ...stock,
        news: title,
        earlySignal: true,
      };
    }),
  };
}

function isRelevantNews(stock: StockSignal, item: NaverNewsItem) {
  const text = stripHtml(item.title ?? "").toLowerCase();
  const name = stock.name.toLowerCase();
  const code = stock.code.toLowerCase();

  return text.includes(name) || text.includes(code);
}

function upsertProvider(snapshot: MarketSnapshot, next: ProviderStatus): MarketSnapshot {
  return {
    ...snapshot,
    providers: [
      ...snapshot.providers.filter((item) => item.id !== next.id),
      next,
    ].sort((a, b) => providerOrder(a.id) - providerOrder(b.id)),
  };
}

function providerOrder(id: ProviderStatus["id"]) {
  if (id === "price") return 1;
  if (id === "disclosure") return 2;
  return 3;
}

async function fetchJson<T>(input: URL, timeoutMs: number, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "stock-expert-analyzer/1.0",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Provider responded with ${response.status}`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function compactNumbers(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getKstYmd(offsetDays: number) {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatDisclosureDate(value: string) {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function wantsRefresh(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/api/market", `https://${host}`);
  return url.searchParams.get("refresh") === "1";
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!wantsRefresh(req) && cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.statusCode = 200;
      res.end(JSON.stringify(cachedSnapshot.snapshot));
      return;
    }

    const snapshot = await buildSnapshot();
    cachedSnapshot = {
      expiresAt: Date.now() + 60_000,
      snapshot,
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify(snapshot));
  } catch {
    const snapshot = getBaseSnapshot();
    const fallback = {
      ...snapshot,
      providers: snapshot.providers.map((item) => item.id === "price" ? item : { ...item, state: "error" as const, detail: `${item.label} API 호출 중 오류가 발생해 기본 데이터를 표시합니다.` }),
      sourceDetail: "외부 API 호출 중 오류가 발생해 기본 데이터를 표시합니다.",
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify(fallback));
  }
}
