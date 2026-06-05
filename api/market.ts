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

type DisclosureTone = "positive" | "watch" | "neutral";

type MarketIndex = {
  name: Market;
  value: number;
  changePct: number;
  turnoverTn: number;
  advancers: number;
  decliners: number;
};

type GlobalIndex = {
  name: string;
  region: string;
  value: number;
  changePct: number;
  source: string;
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
  foreignNetBn: number | null;
  institutionNetBn: number | null;
  programNetBn: number | null;
  news: string;
  disclosure: string;
  disclosureCategory: string;
  disclosureTone: DisclosureTone;
  disclosureScore: number;
  trendScore: number;
  themeRank: number;
  sectorRank: number;
  riskTags: string[];
  earlySignal: boolean;
};

type LiveStockSignal = StockSignal & {
  regularMarketTime?: number;
};

type MarketSnapshot = {
  asOf: string;
  source: "sample" | "yahoo" | "naver";
  sourceDetail: string;
  providers: ProviderStatus[];
  breakingNews: BreakingNewsItem[];
  marketSummary: string;
  briefing: string;
  indices: MarketIndex[];
  globalIndices: GlobalIndex[];
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
  stock_code?: string;
  report_nm?: string;
  rcept_dt?: string;
  rcept_no?: string;
};

type ClassifiedDisclosure = {
  category: string;
  tone: DisclosureTone;
  score: number;
  summary: string;
};

type NaverNewsItem = {
  title?: string;
  description?: string;
  pubDate?: string;
  originallink?: string;
  link?: string;
};

type BreakingNewsItem = {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
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

type YahooIndexData = {
  value: number;
  changePct: number;
  regularMarketTime?: number;
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

type NaverMarketListResponse = {
  stocks?: NaverMarketStock[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
};

type NaverMarketStock = {
  itemCode?: string;
  stockName?: string;
  stockType?: string;
  closePriceRaw?: string;
  fluctuationsRatio?: string;
  accumulatedTradingVolumeRaw?: string;
  accumulatedTradingValueRaw?: string;
  marketValueRaw?: string;
  localTradedAt?: string;
  stockExchangeType?: {
    name?: Market;
  };
};

type NaverIntegrationResponse = {
  dealTrendInfos?: NaverDealTrendInfo[];
};

type NaverDealTrendInfo = {
  bizdate?: string;
  foreignerPureBuyQuant?: string;
  organPureBuyQuant?: string;
  closePrice?: string;
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

function createBaseStock(stock: Omit<StockSignal, "disclosure" | "disclosureCategory" | "disclosureTone" | "disclosureScore">): StockSignal {
  return {
    ...stock,
    disclosure: "최근 공시 확인 전",
    disclosureCategory: "미분류",
    disclosureTone: "neutral",
    disclosureScore: 0,
  };
}

async function buildSnapshot(): Promise<MarketSnapshot> {
  const base = getBaseSnapshot();
  const [marketResult, disclosureResult, newsResult, breakingNewsResult, globalIndexResult] = await Promise.allSettled([
    fetchNaverMarket(base.stocks).catch(() => fetchYahooMarket(base.stocks)),
    fetchDartDisclosures(base.stocks),
    fetchNaverNews(base.stocks),
    fetchBreakingNews(),
    fetchGlobalIndices(),
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
    snapshot = {
      ...snapshot,
      breakingNews: mergeBreakingNews(snapshot.breakingNews, disclosuresToBreakingNews(disclosureResult.value.disclosures)),
    };
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

  if (breakingNewsResult.status === "fulfilled") {
    snapshot = {
      ...snapshot,
      breakingNews: mergeBreakingNews(snapshot.breakingNews, breakingNewsResult.value),
    };
  }

  if (globalIndexResult.status === "fulfilled") {
    snapshot = {
      ...snapshot,
      globalIndices: globalIndexResult.value,
    };
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
  const globalIndices: GlobalIndex[] = [
    { name: "S&P 500", region: "미국", value: 0, changePct: 0, source: "Yahoo Finance" },
    { name: "NASDAQ", region: "미국", value: 0, changePct: 0, source: "Yahoo Finance" },
    { name: "DOW", region: "미국", value: 0, changePct: 0, source: "Yahoo Finance" },
    { name: "NIKKEI 225", region: "일본", value: 0, changePct: 0, source: "Yahoo Finance" },
    { name: "Shanghai", region: "중국", value: 0, changePct: 0, source: "Yahoo Finance" },
    { name: "Hang Seng", region: "홍콩", value: 0, changePct: 0, source: "Yahoo Finance" },
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
    createBaseStock({ code: "000660", name: "SK하이닉스", market: "KOSPI", sector: "반도체", theme: "AI 반도체", changePct: 5.42, volumeRatio: 2.4, turnoverBn: 12850, foreignNetBn: 1820, institutionNetBn: 690, programNetBn: 410, news: "HBM 공급 확대 기대", trendScore: 18, themeRank: 1, sectorRank: 1, riskTags: ["단기 급등"], earlySignal: false }),
    createBaseStock({ code: "058470", name: "리노공업", market: "KOSDAQ", sector: "반도체", theme: "AI 반도체", changePct: 4.18, volumeRatio: 2.1, turnoverBn: 1420, foreignNetBn: 210, institutionNetBn: 130, programNetBn: 48, news: "AI 테스트 소켓 수요", trendScore: 17, themeRank: 1, sectorRank: 1, riskTags: [], earlySignal: false }),
    createBaseStock({ code: "267260", name: "HD현대일렉트릭", market: "KOSPI", sector: "전기장비", theme: "전력기기", changePct: 3.72, volumeRatio: 1.9, turnoverBn: 3380, foreignNetBn: 95, institutionNetBn: 340, programNetBn: 62, news: "북미 전력망 투자 기대", trendScore: 18, themeRank: 2, sectorRank: 2, riskTags: [], earlySignal: false }),
    createBaseStock({ code: "066970", name: "엘앤에프", market: "KOSPI", sector: "2차전지", theme: "2차전지 장비", changePct: 2.12, volumeRatio: 1.7, turnoverBn: 980, foreignNetBn: 74, institutionNetBn: 54, programNetBn: 18, news: "배터리 소재 업황 저점 기대", trendScore: 12, themeRank: 3, sectorRank: 4, riskTags: ["업황 변동성"], earlySignal: true }),
    createBaseStock({ code: "196170", name: "알테오젠", market: "KOSDAQ", sector: "제약·바이오", theme: "바이오 임상", changePct: 3.05, volumeRatio: 1.8, turnoverBn: 2210, foreignNetBn: 160, institutionNetBn: -42, programNetBn: 30, news: "기술이전 기대감", trendScore: 15, themeRank: 4, sectorRank: 3, riskTags: ["이벤트 변동성"], earlySignal: true }),
    createBaseStock({ code: "047810", name: "한국항공우주", market: "KOSPI", sector: "방산", theme: "방산", changePct: 1.62, volumeRatio: 1.5, turnoverBn: 760, foreignNetBn: -18, institutionNetBn: 88, programNetBn: 12, news: "수출 협상 보도", trendScore: 11, themeRank: 5, sectorRank: 5, riskTags: [], earlySignal: true }),
    createBaseStock({ code: "035420", name: "NAVER", market: "KOSPI", sector: "소프트웨어", theme: "AI 서비스", changePct: 0.86, volumeRatio: 1.35, turnoverBn: 1140, foreignNetBn: 122, institutionNetBn: 45, programNetBn: 39, news: "AI 검색 서비스 개편", trendScore: 9, themeRank: 6, sectorRank: 5, riskTags: ["추세 확인 필요"], earlySignal: true }),
    createBaseStock({ code: "034020", name: "두산에너빌리티", market: "KOSPI", sector: "기계", theme: "원전·전력", changePct: -0.28, volumeRatio: 1.22, turnoverBn: 890, foreignNetBn: 66, institutionNetBn: 31, programNetBn: 9, news: "원전 수주 기대 보도", trendScore: 7, themeRank: 7, sectorRank: 4, riskTags: ["가격 모멘텀 약함"], earlySignal: true }),
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
    breakingNews: [],
    marketSummary: "코스닥 강도가 우세하고 AI 반도체·전력기기에 수급과 거래대금이 집중됩니다.",
    briefing: "오늘 시장은 코스닥 강도가 코스피보다 우세하며, AI 반도체와 전력기기에 수급과 거래대금이 집중됩니다. 뉴스와 공시는 외부 API로 보강하며, 단기 급등 종목은 분할 접근과 손절 기준을 먼저 정해야 합니다.",
    indices,
    globalIndices,
    themes,
    sectors,
    stocks,
    scoreModel: [
      { label: "수급 점수", max: 20, rule: "외국인·기관 최근 순매수 우위, 프로그램은 공급자 제공 시 반영" },
      { label: "거래량 점수", max: 15, rule: "5일·20일 평균 대비 거래량 증가 배수" },
      { label: "거래대금 점수", max: 10, rule: "시장 관심을 확인할 수 있는 절대 거래대금" },
      { label: "뉴스 모멘텀", max: 10, rule: "긍정 뉴스, 정책, 수주, 실적 기대 키워드" },
      { label: "공시 모멘텀", max: 10, rule: "DART 공시 자동 분류: 계약, 실적, 주주환원, 자금조달, 지분, 리스크" },
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
    fetchNaverStockUniverse().catch(() => Promise.all(baseStocks.map(fetchNaverStock))),
  ]);
  const asOfTime = Math.max(
    kospi.asOfTime,
    kosdaq.asOfTime,
    ...liveStocks.map((stock) => stock.regularMarketTime ?? 0),
  );
  const supplyCount = liveStocks.filter((stock) => stock.foreignNetBn !== null || stock.institutionNetBn !== null).length;

  return {
    source: "naver",
    status: provider("price", "시세", "connected", `네이버 금융 realtime 시세로 지수와 KOSPI/KOSDAQ ${liveStocks.length}개 종목의 등락률, 거래량, 거래대금을 갱신했습니다. 상위 후보 ${supplyCount}개는 외국인·기관 순매수 수급도 반영했습니다.`),
    asOf: asOfTime > 0 ? new Date(asOfTime).toISOString() : new Date().toISOString(),
    indices: [
      { name: "KOSPI" as const, value: kospi.value, changePct: kospi.changePct },
      { name: "KOSDAQ" as const, value: kosdaq.value, changePct: kosdaq.changePct },
    ],
    stocks: liveStocks.map(({ regularMarketTime, ...stock }) => stock),
  };
}

async function fetchNaverStockUniverse(): Promise<LiveStockSignal[]> {
  const [kospi, kosdaq] = await Promise.all([
    fetchNaverMarketStocks("KOSPI"),
    fetchNaverMarketStocks("KOSDAQ"),
  ]);
  const stocks = [...kospi, ...kosdaq]
    .map(toLiveStockSignal)
    .filter((stock): stock is LiveStockSignal => Boolean(stock));

  if (stocks.length === 0) {
    throw new Error("Naver market list returned no stocks");
  }

  return enrichNaverInvestorFlows(stocks);
}

async function fetchNaverMarketStocks(market: Market): Promise<NaverMarketStock[]> {
  const first = await fetchNaverMarketPage(market, 1);
  const pageSize = first.pageSize || 100;
  const totalPages = Math.max(1, Math.ceil((first.totalCount ?? first.stocks?.length ?? 0) / pageSize));
  const pages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);
  const rest = await mapLimit(pages, 6, (page) => fetchNaverMarketPage(market, page).catch(() => ({ stocks: [] })));

  return [first, ...rest].flatMap((page) => page.stocks ?? []);
}

async function fetchNaverMarketPage(market: Market, page: number) {
  const url = new URL(`https://m.stock.naver.com/api/stocks/marketValue/${market}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", "100");

  return fetchNaverJson<NaverMarketListResponse>(url, 5_000);
}

function toLiveStockSignal(item: NaverMarketStock): LiveStockSignal | undefined {
  const code = item.itemCode?.trim();
  const name = item.stockName?.trim();
  const market = item.stockExchangeType?.name;

  if (!code || !name || (market !== "KOSPI" && market !== "KOSDAQ")) {
    return undefined;
  }

  if (!isCompanyStockName(name)) {
    return undefined;
  }

  const changePct = parseNaverNumber(item.fluctuationsRatio);
  const turnoverBn = parseNaverNumber(item.accumulatedTradingValueRaw) / 100_000_000;
  const marketValueBn = parseNaverNumber(item.marketValueRaw) / 100_000_000;
  const turnoverPct = marketValueBn > 0 ? (turnoverBn / marketValueBn) * 100 : 0;
  const volumeRatio = Math.max(0.1, Math.min(9.9, turnoverPct > 0 ? turnoverPct * 2 : Math.log10(turnoverBn + 10) / 2));
  const profile = classifyStock(name, market);
  const trendScore = Math.max(1, Math.min(20, Math.round(8 + changePct * 1.6 + Math.min(volumeRatio, 4) * 2)));
  const riskTags = getBroadMarketRiskTags(changePct, volumeRatio, turnoverBn);
  const regularMarketTime = parseNaverTime(item.localTradedAt);

  return {
    code,
    name,
    market,
    sector: profile.sector,
    theme: profile.theme,
    changePct,
    volumeRatio,
    turnoverBn,
    foreignNetBn: null,
    institutionNetBn: null,
    programNetBn: null,
    news: "네이버 금융 실시간 시세 반영",
    disclosure: "최근 공시 확인 전",
    disclosureCategory: "미분류",
    disclosureTone: "neutral",
    disclosureScore: 0,
    trendScore,
    themeRank: 99,
    sectorRank: 99,
    riskTags,
    earlySignal: changePct > 0 || volumeRatio >= 1.5,
    regularMarketTime,
  };
}

async function enrichNaverInvestorFlows(stocks: LiveStockSignal[]): Promise<LiveStockSignal[]> {
  const candidates = stocks
    .slice()
    .sort((a, b) => getSupplyFetchPriority(b) - getSupplyFetchPriority(a))
    .slice(0, 160);
  const pairs = await mapLimit(candidates, 8, async (stock) => {
    const flow = await fetchNaverInvestorFlow(stock).catch(() => undefined);
    return [stock.code, flow] as const;
  });
  const flowByCode = new Map(pairs.filter((pair) => pair[1]).map(([code, flow]) => [code, flow!]));

  return stocks.map((stock) => {
    const flow = flowByCode.get(stock.code);
    if (!flow) return stock;

    return {
      ...stock,
      foreignNetBn: flow.foreignNetBn,
      institutionNetBn: flow.institutionNetBn,
      earlySignal: stock.earlySignal || flow.foreignNetBn > 0 || flow.institutionNetBn > 0,
    };
  });
}

function getSupplyFetchPriority(stock: StockSignal) {
  return stock.trendScore * 3
    + Math.max(-10, Math.min(10, stock.changePct)) * 2
    + Math.min(10, stock.volumeRatio) * 3
    + Math.min(20, Math.log10(stock.turnoverBn + 10) * 4);
}

async function fetchNaverInvestorFlow(stock: StockSignal) {
  const url = new URL(`https://m.stock.naver.com/api/stock/${stock.code}/integration`);
  const body = await fetchNaverJson<NaverIntegrationResponse>(url, 4_000);
  const latest = body.dealTrendInfos?.[0];
  const closePrice = parseNaverNumber(latest?.closePrice);
  const foreignQty = parseNaverNumber(latest?.foreignerPureBuyQuant);
  const institutionQty = parseNaverNumber(latest?.organPureBuyQuant);

  if (!latest || closePrice <= 0) {
    throw new Error(`${stock.code} investor flow data is incomplete`);
  }

  return {
    foreignNetBn: (foreignQty * closePrice) / 100_000_000,
    institutionNetBn: (institutionQty * closePrice) / 100_000_000,
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
  if (item.rf === "3") return 0;
  if (item.cr < 0) return item.cr;
  const sign = item.rf === "4" || item.rf === "5" ? -1 : 1;
  return Math.abs(item.cr) * sign;
}

async function fetchGlobalIndices(): Promise<GlobalIndex[]> {
  const symbols = [
    { name: "S&P 500", region: "미국", symbol: "^GSPC" },
    { name: "NASDAQ", region: "미국", symbol: "^IXIC" },
    { name: "DOW", region: "미국", symbol: "^DJI" },
    { name: "NIKKEI 225", region: "일본", symbol: "^N225" },
    { name: "Shanghai", region: "중국", symbol: "000001.SS" },
    { name: "Hang Seng", region: "홍콩", symbol: "^HSI" },
  ];

  const results = await Promise.allSettled(
    symbols.map(async (item) => {
      const index = await fetchYahooIndex(item.name, item.symbol);
      return {
        name: item.name,
        region: item.region,
        value: index.value,
        changePct: index.changePct,
        source: "Yahoo Finance",
      };
    }),
  );

  const indices = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (indices.length === 0) {
    throw new Error("Global Yahoo index data is unavailable");
  }

  return indices;
}

async function fetchYahooIndex(name: string, symbol: string): Promise<YahooIndexData> {
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
  const sourceName = marketData.source === "naver" ? "네이버 금융 실시간 시세" : "Yahoo Finance 지연 시세";

  return {
    ...snapshot,
    asOf: marketData.asOf,
    source: marketData.source,
    marketSummary,
    briefing: `${marketSummary} 종목 등락률, 거래량, 거래대금은 ${sourceName}를 반영했고 수급·뉴스·공시는 보강 데이터로 함께 계산했습니다.`,
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

function getBroadMarketRiskTags(changePct: number, volumeRatio: number, turnoverBn: number) {
  const tags: string[] = [];

  if (changePct >= 8) tags.push("상한가 근접");
  else if (changePct >= 5) tags.push("단기 급등");

  if (changePct <= -5) tags.push("낙폭 확대");
  else if (changePct <= -3) tags.push("가격 약세");

  if (volumeRatio >= 4) tags.push("거래 집중");
  if (turnoverBn >= 1000) tags.push("거래대금 상위");
  if (changePct < 0 && volumeRatio < 0.5) tags.push("추세 확인 필요");

  return tags;
}

function classifyStock(name: string, market: Market) {
  const checks: Array<{ keywords: string[]; sector: string; theme: string }> = [
    { keywords: ["삼성전자", "SK하이닉스", "하이닉스", "리노공업", "HPSP", "ISC", "주성", "원익", "이오테크닉스", "테크윙", "피에스케이", "한미반도체"], sector: "반도체", theme: "AI 반도체" },
    { keywords: ["NAVER", "카카오", "더존", "안랩", "엔씨", "크래프톤", "넷마블", "위메이드", "펄어비스"], sector: "소프트웨어", theme: "AI 서비스" },
    { keywords: ["LG에너지솔루션", "삼성SDI", "에코프로", "엘앤에프", "포스코퓨처", "POSCO", "천보", "대주전자", "나노신소재"], sector: "2차전지", theme: "2차전지" },
    { keywords: ["셀트리온", "삼성바이오", "알테오젠", "리가켐", "제약", "바이오", "약품", "헬스케어", "케어젠", "보로노이", "유한양행"], sector: "제약·바이오", theme: "바이오 임상" },
    { keywords: ["한화에어로", "한국항공", "LIG", "현대로템", "풍산", "스페코", "빅텍"], sector: "방산", theme: "방산" },
    { keywords: ["두산에너빌리티", "HD현대일렉트릭", "LS ELECTRIC", "일진전기", "효성중공업", "제룡전기", "보성파워텍"], sector: "전기장비", theme: "원전·전력" },
    { keywords: ["현대차", "기아", "현대모비스", "HL만도", "에스엘"], sector: "자동차", theme: "자동차" },
    { keywords: ["KB금융", "신한지주", "하나금융", "우리금융", "삼성생명", "메리츠금융", "기업은행"], sector: "금융", theme: "금융" },
    { keywords: ["HD현대", "한화오션", "삼성중공업", "한국조선", "조선", "STX"], sector: "조선·해운", theme: "조선" },
    { keywords: ["아모레", "콜마", "코스맥스", "클리오", "실리콘투"], sector: "화장품", theme: "K뷰티" },
  ];
  const normalized = name.toUpperCase();
  const hit = checks.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toUpperCase())));

  if (hit) return { sector: hit.sector, theme: hit.theme };

  return market === "KOSPI"
    ? { sector: "기타 KOSPI", theme: "코스피 상대강도" }
    : { sector: "기타 KOSDAQ", theme: "코스닥 상대강도" };
}

function isCompanyStockName(name: string) {
  const compact = name.replace(/\s+/g, "").toUpperCase();
  const productPrefixes = [
    "KODEX",
    "TIGER",
    "SOL",
    "ACE",
    "RISE",
    "KBSTAR",
    "HANARO",
    "KOSEF",
    "ARIRANG",
    "KINDEX",
    "TIMEFOLIO",
    "PLUS",
    "UNICORN",
    "WOORI",
    "1Q",
    "마이다스",
    "파워",
    "마이티",
    "BNK",
    "HK",
  ];
  const productKeywords = [
    "ETF",
    "ETN",
    "ELW",
    "인버스",
    "레버리지",
    "선물",
    "채권",
    "혼합",
    "액티브",
    "커버드콜",
    "합성",
    "국채",
    "회사채",
    "단일종목",
    "나스닥",
    "NASDAQ",
    "S&P",
    "MSCI",
    "코스피200",
    "코스닥150",
    "스팩",
    "SPAC",
    "리츠",
  ];

  if (productPrefixes.some((prefix) => compact.startsWith(prefix))) return false;
  if (productKeywords.some((keyword) => compact.includes(keyword.toUpperCase()))) return false;
  if (/[0-9]+X$/.test(compact)) return false;
  if (/우(B)?$/.test(compact)) return false;

  return true;
}

function parseNaverNumber(value?: string) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNaverTime(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(/\./g, "-"));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
  const classifiedCount = disclosures.filter((item) => classifyDisclosure(item.report_nm ?? "").category !== "기타").length;

  return {
    status: provider("disclosure", "공시", "connected", `DART 최근 14일 공시 ${disclosures.length}건을 연결했고 ${classifiedCount}건을 자동 분류했습니다. 기본 관심 종목 관련 ${matchedCount}건을 우선 확인했습니다.`),
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
      .filter((item) => isFreshNewsDate(item.pubDate, 7))
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

async function fetchBreakingNews(): Promise<BreakingNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return [];
  }

  const queries = [
    "오늘 증시 코스피 코스닥 특징주",
    "오늘 국내증시 외국인 기관 순매수",
    "오늘 공시 특징주 주식",
    "오늘 미국증시 환율 반도체",
  ];
  const bodies = await Promise.allSettled(queries.map((query) => {
    const url = new URL("https://openapi.naver.com/v1/search/news.json");
    url.searchParams.set("query", query);
    url.searchParams.set("display", "15");
    url.searchParams.set("sort", "date");

    return fetchJson<{ items?: NaverNewsItem[] }>(url, 4_000, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });
  }));
  const items = bodies.flatMap((result) => result.status === "fulfilled" ? result.value.items ?? [] : []);
  const todayItems = items.filter((item) => isTodayNewsDate(item.pubDate));
  const usableItems = todayItems.length ? todayItems : items.filter((item) => isFreshNewsDate(item.pubDate, 2));

  return usableItems
    .map((item) => {
      const title = stripHtml(item.title ?? "");
      const summary = stripHtml(item.description ?? "");
      const url = item.originallink || item.link || "";

      return {
        title,
        summary,
        source: getNewsSource(url),
        url,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      };
    })
    .filter((item) => item.title && item.url)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url || candidate.title === item.title) === index)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 12);
}

function mergeBreakingNews(...groups: BreakingNewsItem[][]) {
  return groups
    .flat()
    .filter((item) => item.title && item.url)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url || candidate.title === item.title) === index)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 12);
}

function disclosuresToBreakingNews(disclosures: DartDisclosure[]): BreakingNewsItem[] {
  const today = getKstYmd(0);
  return disclosures
    .filter((item) => item.rcept_dt === today)
    .slice(0, 8)
    .map((item) => {
      const report = item.report_nm ?? "공시";
      const company = item.corp_name ?? "상장사";
      return {
        title: `${company} ${report}`,
        summary: "DART 오늘 공시입니다. 투자 판단 전 공시 원문과 정정 여부를 확인하세요.",
        source: "DART 공시",
        url: item.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}` : "https://dart.fss.or.kr/",
        publishedAt: kstYmdToIso(item.rcept_dt ?? today),
      };
    });
}

function applyDisclosures(snapshot: MarketSnapshot, disclosures: DartDisclosure[]): MarketSnapshot {
  if (disclosures.length === 0) return snapshot;

  const disclosureByName = new Map<string, DartDisclosure>();
  const disclosureByCode = new Map<string, DartDisclosure>();

  for (const disclosure of disclosures) {
    if (disclosure.corp_name && !disclosureByName.has(disclosure.corp_name)) {
      disclosureByName.set(disclosure.corp_name, disclosure);
    }
    if (disclosure.stock_code && !disclosureByCode.has(disclosure.stock_code)) {
      disclosureByCode.set(disclosure.stock_code, disclosure);
    }
  }

  return {
    ...snapshot,
    stocks: snapshot.stocks.map((stock) => {
      const hit = disclosureByCode.get(stock.code) ?? disclosureByName.get(stock.name);
      if (!hit?.report_nm) return stock;
      const classified = classifyDisclosure(hit.report_nm);
      const riskTags = classified.tone === "watch"
        ? Array.from(new Set([...stock.riskTags, classified.category]))
        : stock.riskTags;

      return {
        ...stock,
        disclosure: `${classified.summary}${hit.rcept_dt ? ` (${formatDisclosureDate(hit.rcept_dt)})` : ""}`,
        disclosureCategory: classified.category,
        disclosureTone: classified.tone,
        disclosureScore: classified.score,
        trendScore: Math.max(1, Math.min(20, stock.trendScore + Math.round(classified.score / 3))),
        riskTags,
        earlySignal: true,
      };
    }),
  };
}

function classifyDisclosure(reportName: string): ClassifiedDisclosure {
  const normalized = reportName.replace(/\s+/g, "");
  const rules: Array<{ category: string; tone: DisclosureTone; score: number; keywords: string[] }> = [
    { category: "주의 공시", tone: "watch", score: -10, keywords: ["불성실공시", "상장폐지", "관리종목", "거래정지", "횡령", "배임", "투자경고", "조회공시요구"] },
    { category: "자금조달", tone: "watch", score: -6, keywords: ["유상증자", "전환사채", "신주인수권", "교환사채", "사채권", "증권발행결과"] },
    { category: "계약·수주", tone: "positive", score: 10, keywords: ["단일판매", "공급계약", "수주", "판매ㆍ공급계약", "판매·공급계약"] },
    { category: "실적", tone: "positive", score: 8, keywords: ["잠정실적", "영업(잠정)실적", "매출액또는손익구조", "영업이익", "실적"] },
    { category: "주주환원", tone: "positive", score: 8, keywords: ["자기주식취득", "자기주식처분", "주식소각", "현금ㆍ현물배당", "배당"] },
    { category: "바이오·임상", tone: "positive", score: 8, keywords: ["임상", "품목허가", "기술이전", "특허권", "라이선스"] },
    { category: "지분·M&A", tone: "neutral", score: 5, keywords: ["타법인주식", "회사합병", "회사분할", "주식등의대량보유", "임원ㆍ주요주주", "최대주주"] },
    { category: "거버넌스", tone: "neutral", score: 3, keywords: ["주주총회", "대표이사", "이사회", "감사보고서"] },
  ];
  const hit = rules.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword.replace(/\s+/g, ""))));
  const category = hit?.category ?? "기타";
  const tone = hit?.tone ?? "neutral";
  const score = hit?.score ?? 1;

  return {
    category,
    tone,
    score,
    summary: `[${category}] ${reportName}`,
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

function getNewsSource(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "NAVER 뉴스";
  }
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

async function fetchNaverJson<T>(input: URL, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Naver responded with ${response.status}`);
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

function kstYmdToIso(value: string) {
  if (value.length !== 8) return new Date().toISOString();
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return new Date(`${year}-${month}-${day}T09:00:00+09:00`).toISOString();
}

function isFreshNewsDate(value: string | undefined, maxAgeDays: number) {
  if (!value) return false;
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return false;
  const nowKst = Date.now() + 9 * 60 * 60 * 1000;
  const publishedKst = published.getTime() + 9 * 60 * 60 * 1000;
  const ageDays = (nowKst - publishedKst) / (24 * 60 * 60 * 1000);

  return ageDays >= 0 && ageDays <= maxAgeDays;
}

function isTodayNewsDate(value: string | undefined) {
  if (!value) return false;
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return false;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(published) === formatter.format(new Date());
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
      expiresAt: Date.now() + 20_000,
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
