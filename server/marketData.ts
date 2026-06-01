export type Market = "KOSPI" | "KOSDAQ";

export type MarketIndex = {
  name: Market;
  value: number;
  changePct: number;
  turnoverTn: number;
  advancers: number;
  decliners: number;
};

export type StrengthItem = {
  name: string;
  changePct: number;
  strength: number;
  flow: string;
  lead: string;
};

export type StockSignal = {
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

export type ScoreModelItem = {
  label: string;
  max: number;
  rule: string;
};

export type MarketSnapshot = {
  asOf: string;
  source: "sample" | "yahoo";
  sourceDetail: string;
  providers: ProviderStatus[];
  marketSummary: string;
  briefing: string;
  indices: MarketIndex[];
  themes: StrengthItem[];
  sectors: StrengthItem[];
  stocks: StockSignal[];
  scoreModel: ScoreModelItem[];
};

export type ProviderStatus = {
  id: "price" | "disclosure" | "news";
  label: string;
  state: "connected" | "missing_key" | "fallback" | "error";
  detail: string;
  requiredEnv?: string[];
};

type YahooQuote = {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  averageDailyVolume10Day?: number;
};

type CachedSnapshot = {
  expiresAt: number;
  snapshot: MarketSnapshot;
};

type DisclosureHit = {
  corp_name?: string;
  report_nm?: string;
  rcept_dt?: string;
};

type NaverNewsItem = {
  title?: string;
  description?: string;
  pubDate?: string;
};

const YAHOO_SYMBOLS: Record<string, string> = {
  KOSPI: "^KS11",
  KOSDAQ: "^KQ11",
  "000660": "000660.KS",
  "058470": "058470.KQ",
  "267260": "267260.KS",
  "066970": "066970.KQ",
  "196170": "196170.KQ",
  "047810": "047810.KS",
  "035420": "035420.KS",
  "034020": "034020.KS",
};

let cachedSnapshot: CachedSnapshot | undefined;

const indices: MarketIndex[] = [
  { name: "KOSPI", value: 2792.41, changePct: 0.82, turnoverTn: 9.8, advancers: 512, decliners: 358 },
  { name: "KOSDAQ", value: 874.26, changePct: 1.47, turnoverTn: 7.1, advancers: 827, decliners: 514 },
];

const themes: StrengthItem[] = [
  { name: "AI 반도체", changePct: 4.8, strength: 92, flow: "외국인·기관 동시 유입", lead: "SK하이닉스, 리노공업" },
  { name: "전력기기", changePct: 3.9, strength: 86, flow: "기관 3일 순매수", lead: "HD현대일렉트릭, LS ELECTRIC" },
  { name: "2차전지 장비", changePct: 3.3, strength: 80, flow: "거래대금 회복", lead: "피엔티, 하나기술" },
  { name: "바이오 임상", changePct: 2.9, strength: 76, flow: "공시·뉴스 동반", lead: "알테오젠, 에이비엘바이오" },
  { name: "방산", changePct: 2.4, strength: 71, flow: "수주 기대", lead: "한화에어로스페이스" },
];

const sectors: StrengthItem[] = [
  { name: "반도체", changePct: 3.6, strength: 90, flow: "대형주와 소부장 동반 상승", lead: "SK하이닉스, HPSP" },
  { name: "전기장비", changePct: 3.1, strength: 84, flow: "기관 수급 우위", lead: "HD현대일렉트릭" },
  { name: "제약·바이오", changePct: 2.6, strength: 77, flow: "임상 이벤트 기대", lead: "알테오젠" },
  { name: "기계", changePct: 2.1, strength: 70, flow: "수출·수주 모멘텀", lead: "두산에너빌리티" },
  { name: "소프트웨어", changePct: 1.8, strength: 66, flow: "AI 서비스 확산", lead: "NAVER" },
];

const stocks: StockSignal[] = [
  {
    code: "000660",
    name: "SK하이닉스",
    market: "KOSPI",
    sector: "반도체",
    theme: "AI 반도체",
    changePct: 5.42,
    volumeRatio: 2.4,
    turnoverBn: 12850,
    foreignNetBn: 1820,
    institutionNetBn: 690,
    programNetBn: 410,
    news: "HBM 공급 확대 기대",
    disclosure: "실적 컨센서스 상향",
    trendScore: 18,
    themeRank: 1,
    sectorRank: 1,
    riskTags: ["단기 급등"],
    earlySignal: false,
  },
  {
    code: "058470",
    name: "리노공업",
    market: "KOSDAQ",
    sector: "반도체",
    theme: "AI 반도체",
    changePct: 4.18,
    volumeRatio: 2.1,
    turnoverBn: 1420,
    foreignNetBn: 210,
    institutionNetBn: 130,
    programNetBn: 48,
    news: "AI 테스트 소켓 수요",
    disclosure: "특이 공시 없음",
    trendScore: 17,
    themeRank: 1,
    sectorRank: 1,
    riskTags: [],
    earlySignal: false,
  },
  {
    code: "267260",
    name: "HD현대일렉트릭",
    market: "KOSPI",
    sector: "전기장비",
    theme: "전력기기",
    changePct: 3.72,
    volumeRatio: 1.9,
    turnoverBn: 3380,
    foreignNetBn: 95,
    institutionNetBn: 340,
    programNetBn: 62,
    news: "북미 전력망 투자 기대",
    disclosure: "수주 잔고 증가",
    trendScore: 18,
    themeRank: 2,
    sectorRank: 2,
    riskTags: [],
    earlySignal: false,
  },
  {
    code: "066970",
    name: "엘앤에프",
    market: "KOSDAQ",
    sector: "2차전지",
    theme: "2차전지 장비",
    changePct: 2.12,
    volumeRatio: 1.7,
    turnoverBn: 980,
    foreignNetBn: 74,
    institutionNetBn: 54,
    programNetBn: 18,
    news: "배터리 소재 업황 저점 기대",
    disclosure: "공급계약 검토 보도",
    trendScore: 12,
    themeRank: 3,
    sectorRank: 4,
    riskTags: ["업황 변동성"],
    earlySignal: true,
  },
  {
    code: "196170",
    name: "알테오젠",
    market: "KOSDAQ",
    sector: "제약·바이오",
    theme: "바이오 임상",
    changePct: 3.05,
    volumeRatio: 1.8,
    turnoverBn: 2210,
    foreignNetBn: 160,
    institutionNetBn: -42,
    programNetBn: 30,
    news: "기술이전 기대감",
    disclosure: "임상 일정 업데이트",
    trendScore: 15,
    themeRank: 4,
    sectorRank: 3,
    riskTags: ["이벤트 변동성"],
    earlySignal: true,
  },
  {
    code: "047810",
    name: "한국항공우주",
    market: "KOSPI",
    sector: "방산",
    theme: "방산",
    changePct: 1.62,
    volumeRatio: 1.5,
    turnoverBn: 760,
    foreignNetBn: -18,
    institutionNetBn: 88,
    programNetBn: 12,
    news: "수출 협상 보도",
    disclosure: "공급계약 기대",
    trendScore: 11,
    themeRank: 5,
    sectorRank: 5,
    riskTags: [],
    earlySignal: true,
  },
  {
    code: "035420",
    name: "NAVER",
    market: "KOSPI",
    sector: "소프트웨어",
    theme: "AI 서비스",
    changePct: 0.86,
    volumeRatio: 1.35,
    turnoverBn: 1140,
    foreignNetBn: 122,
    institutionNetBn: 45,
    programNetBn: 39,
    news: "AI 검색 서비스 개편",
    disclosure: "특이 공시 없음",
    trendScore: 9,
    themeRank: 6,
    sectorRank: 5,
    riskTags: ["추세 확인 필요"],
    earlySignal: true,
  },
  {
    code: "034020",
    name: "두산에너빌리티",
    market: "KOSPI",
    sector: "기계",
    theme: "원전·전력",
    changePct: -0.28,
    volumeRatio: 1.22,
    turnoverBn: 890,
    foreignNetBn: 66,
    institutionNetBn: 31,
    programNetBn: 9,
    news: "원전 수주 기대 보도",
    disclosure: "사업보고서 제출",
    trendScore: 7,
    themeRank: 7,
    sectorRank: 4,
    riskTags: ["가격 모멘텀 약함"],
    earlySignal: true,
  },
];

const scoreModel: ScoreModelItem[] = [
  { label: "수급 점수", max: 20, rule: "외국인·기관 3일 순매수, 프로그램 순매수 우위" },
  { label: "거래량 점수", max: 15, rule: "5일·20일 평균 대비 거래량 증가 배수" },
  { label: "거래대금 점수", max: 10, rule: "시장 관심을 확인할 수 있는 절대 거래대금" },
  { label: "뉴스 모멘텀", max: 10, rule: "긍정 뉴스, 정책, 수주, 실적 기대 키워드" },
  { label: "공시 모멘텀", max: 10, rule: "수주, 계약, 실적, 임상, 자사주, M&A 공시" },
  { label: "테마 강도", max: 10, rule: "테마 내 상대강도와 동반 상승 종목 수" },
  { label: "업종 강도", max: 10, rule: "업종 수익률과 업종 내 주도주 확산" },
  { label: "추세 점수", max: 15, rule: "단기·중기 추세, 신고가, 눌림 후 재상승" },
  { label: "리스크 감점", max: -20, rule: "단기 과열, 관리종목, 투자주의, 공시 불확실성" },
];

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot.snapshot;
  }

  const snapshot = await getYahooSnapshot()
    .catch(() => getSampleSnapshot())
    .then(enrichSnapshot);
  cachedSnapshot = {
    expiresAt: Date.now() + 60_000,
    snapshot,
  };

  return snapshot;
}

function getSampleSnapshot(): MarketSnapshot {
  return {
    asOf: new Date().toISOString(),
    source: "sample",
    sourceDetail: "외부 시세 공급자가 응답하지 않아 내장 샘플 데이터를 표시합니다.",
    providers: [
      { id: "price", label: "시세", state: "fallback", detail: "외부 시세 공급자 대신 내장 샘플 데이터를 사용 중입니다." },
      { id: "disclosure", label: "공시", state: "missing_key", detail: "DART 공시 API 키가 아직 없습니다.", requiredEnv: ["DART_API_KEY"] },
      { id: "news", label: "뉴스", state: "missing_key", detail: "네이버 뉴스 검색 API 키가 아직 없습니다.", requiredEnv: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"] },
    ],
    marketSummary: "코스닥 강도가 우세하고 AI 반도체·전력기기에 수급과 거래대금이 집중됩니다.",
    briefing: "오늘 시장은 코스닥 강도가 코스피보다 우세하며, AI 반도체와 전력기기에 수급과 거래대금이 집중됩니다. 다음 순환 후보는 가격 부담이 낮고 초기 거래량이 늘어난 2차전지 장비, 원전·전력입니다. 추천 3선은 투자 참고용이며, 단기 급등 종목은 분할 접근과 손절 기준을 먼저 정해야 합니다.",
    indices,
    themes,
    sectors,
    stocks,
    scoreModel,
  };
}

async function getYahooSnapshot(): Promise<MarketSnapshot> {
  const symbols = Object.values(YAHOO_SYMBOLS);
  const quotes = await fetchYahooQuotes(symbols);
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const liveStocks = stocks.map((stock) => mergeYahooStock(stock, quoteBySymbol.get(YAHOO_SYMBOLS[stock.code])));
  const liveIndices = indices.map((index) => mergeYahooIndex(index, quoteBySymbol.get(YAHOO_SYMBOLS[index.name])));
  const liveThemes = deriveStrengthItems(liveStocks, "theme", themes);
  const liveSectors = deriveStrengthItems(liveStocks, "sector", sectors);
  const marketSummary = buildMarketSummary(liveIndices, liveThemes);

  return {
    asOf: new Date().toISOString(),
    source: "yahoo",
    sourceDetail: "Yahoo Finance 지연 시세를 기준으로 가격, 등락률, 거래량, 거래대금을 갱신했습니다. 수급·뉴스·공시는 보강 데이터입니다.",
    providers: [
      { id: "price", label: "시세", state: "connected", detail: "Yahoo Finance 지연 시세가 연결되었습니다." },
      { id: "disclosure", label: "공시", state: "missing_key", detail: "DART 공시 API 키가 아직 없습니다.", requiredEnv: ["DART_API_KEY"] },
      { id: "news", label: "뉴스", state: "missing_key", detail: "네이버 뉴스 검색 API 키가 아직 없습니다.", requiredEnv: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"] },
    ],
    marketSummary,
    briefing: `${marketSummary} 추천 종목은 실시간성 가격 데이터와 보강 수급·뉴스 신호를 합산한 참고용 결과이며, 실제 매수·매도 판단 전에는 증권사 호가와 공시 원문을 다시 확인해야 합니다.`,
    indices: liveIndices,
    themes: liveThemes,
    sectors: liveSectors,
    stocks: liveStocks,
    scoreModel,
  };
}

async function fetchYahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_200);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "stock-expert-analyzer/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance responded with ${response.status}`);
    }

    const body = await response.json() as { quoteResponse?: { result?: YahooQuote[] } };
    const quotes = body.quoteResponse?.result ?? [];

    if (quotes.length === 0) {
      throw new Error("Yahoo Finance returned no quote data");
    }

    return quotes;
  } finally {
    clearTimeout(timer);
  }
}

function mergeYahooIndex(index: MarketIndex, quote?: YahooQuote): MarketIndex {
  if (!quote?.regularMarketPrice) return index;

  return {
    ...index,
    value: quote.regularMarketPrice,
    changePct: quote.regularMarketChangePercent ?? index.changePct,
  };
}

function mergeYahooStock(stock: StockSignal, quote?: YahooQuote): StockSignal {
  if (!quote?.regularMarketPrice) return stock;

  const volume = quote.regularMarketVolume ?? 0;
  const averageVolume = quote.averageDailyVolume10Day || quote.averageDailyVolume3Month || 0;
  const volumeRatio = averageVolume > 0 ? volume / averageVolume : stock.volumeRatio;
  const turnoverBn = volume > 0 ? (quote.regularMarketPrice * volume) / 100_000_000 : stock.turnoverBn;
  const changePct = quote.regularMarketChangePercent ?? stock.changePct;
  const riskTags = new Set(stock.riskTags);

  if (changePct >= 6) riskTags.add("단기 급등");
  if (changePct <= -3) riskTags.add("가격 약세");
  if (volumeRatio >= 2.5) riskTags.add("거래량 과열");

  return {
    ...stock,
    changePct,
    volumeRatio,
    turnoverBn,
    riskTags: Array.from(riskTags),
  };
}

function deriveStrengthItems(
  stockList: StockSignal[],
  key: "theme" | "sector",
  fallback: StrengthItem[],
): StrengthItem[] {
  const grouped = new Map<string, StockSignal[]>();

  for (const stock of stockList) {
    const groupName = stock[key];
    grouped.set(groupName, [...(grouped.get(groupName) ?? []), stock]);
  }

  return Array.from(grouped.entries())
    .map(([name, members]) => {
      const averageChange = average(members.map((stock) => stock.changePct));
      const averageVolumeRatio = average(members.map((stock) => stock.volumeRatio));
      const base = fallback.find((item) => item.name === name);
      const strength = Math.max(1, Math.min(100, Math.round(50 + averageChange * 8 + averageVolumeRatio * 7 + members.length * 2)));
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
        flow: base?.flow ?? "가격·거래량 동반 확인",
        lead,
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMarketSummary(liveIndices: MarketIndex[], liveThemes: StrengthItem[]) {
  const leadingMarket = liveIndices
    .slice()
    .sort((a, b) => b.changePct - a.changePct)[0];
  const leadingThemes = liveThemes.slice(0, 2).map((theme) => theme.name).join("·");

  if (!leadingMarket || !leadingThemes) {
    return "시장 데이터가 일부 제한되어 핵심 강세 테마를 보수적으로 표시합니다.";
  }

  return `${leadingMarket.name} 강도가 상대적으로 우세하고 ${leadingThemes}에 가격과 거래량 신호가 집중됩니다.`;
}

async function enrichSnapshot(snapshot: MarketSnapshot): Promise<MarketSnapshot> {
  const [disclosureResult, newsResult] = await Promise.allSettled([
    fetchDartDisclosures(),
    fetchNaverNews(stocks),
  ]);

  let next = { ...snapshot };

  if (disclosureResult.status === "fulfilled") {
    next = applyDisclosures(next, disclosureResult.value.disclosures);
    next.providers = upsertProvider(next.providers, disclosureResult.value.status);
  } else {
    next.providers = upsertProvider(next.providers, {
      id: "disclosure",
      label: "공시",
      state: "error",
      detail: "DART 공시 데이터를 불러오지 못했습니다.",
      requiredEnv: ["DART_API_KEY"],
    });
  }

  if (newsResult.status === "fulfilled") {
    next = applyNews(next, newsResult.value.newsByStock);
    next.providers = upsertProvider(next.providers, newsResult.value.status);
  } else {
    next.providers = upsertProvider(next.providers, {
      id: "news",
      label: "뉴스",
      state: "error",
      detail: "네이버 뉴스 데이터를 불러오지 못했습니다.",
      requiredEnv: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
    });
  }

  return {
    ...next,
    sourceDetail: buildSourceDetail(next.providers),
  };
}

async function fetchDartDisclosures(): Promise<{ status: ProviderStatus; disclosures: DisclosureHit[] }> {
  const apiKey = process.env.DART_API_KEY?.trim();

  if (!apiKey) {
    return {
      status: {
        id: "disclosure",
        label: "공시",
        state: "missing_key",
        detail: "DART_API_KEY가 없어 공시 자동 보강을 건너뜁니다.",
        requiredEnv: ["DART_API_KEY"],
      },
      disclosures: [],
    };
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  const url = new URL("https://opendart.fss.or.kr/api/list.json");
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("bgn_de", formatYmd(startDate));
  url.searchParams.set("end_de", formatYmd(endDate));
  url.searchParams.set("page_no", "1");
  url.searchParams.set("page_count", "100");
  url.searchParams.set("sort", "date");
  url.searchParams.set("sort_mth", "desc");

  const response = await fetchWithTimeout(url, 4_000);
  const body = await response.json() as { status?: string; message?: string; list?: DisclosureHit[] };

  if (body.status && body.status !== "000") {
    throw new Error(body.message || "DART API error");
  }

  return {
    status: {
      id: "disclosure",
      label: "공시",
      state: "connected",
      detail: "DART 최근 7일 공시 목록을 연결했습니다.",
    },
    disclosures: body.list ?? [],
  };
}

async function fetchNaverNews(stockList: StockSignal[]): Promise<{ status: ProviderStatus; newsByStock: Map<string, NaverNewsItem[]> }> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return {
      status: {
        id: "news",
        label: "뉴스",
        state: "missing_key",
        detail: "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 없어 뉴스 자동 보강을 건너뜁니다.",
        requiredEnv: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
      },
      newsByStock: new Map(),
    };
  }

  const pairs = await Promise.all(stockList.map(async (stock) => {
    const url = new URL("https://openapi.naver.com/v1/search/news.json");
    url.searchParams.set("query", `${stock.name} ${stock.theme}`);
    url.searchParams.set("display", "3");
    url.searchParams.set("sort", "date");
    const response = await fetchWithTimeout(url, 4_000, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });
    const body = await response.json() as { items?: NaverNewsItem[] };
    return [stock.code, body.items ?? []] as const;
  }));

  return {
    status: {
      id: "news",
      label: "뉴스",
      state: "connected",
      detail: "네이버 뉴스 검색 API로 종목별 최근 뉴스를 연결했습니다.",
    },
    newsByStock: new Map(pairs),
  };
}

function applyDisclosures(snapshot: MarketSnapshot, disclosures: DisclosureHit[]): MarketSnapshot {
  if (disclosures.length === 0) return snapshot;

  const disclosureByName = new Map<string, DisclosureHit>();
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
        disclosure: `${hit.report_nm}${hit.rcept_dt ? ` (${hit.rcept_dt})` : ""}`,
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

function upsertProvider(providers: ProviderStatus[], next: ProviderStatus): ProviderStatus[] {
  const rest = providers.filter((provider) => provider.id !== next.id);
  return [...rest, next].sort((a, b) => providerOrder(a.id) - providerOrder(b.id));
}

function providerOrder(id: ProviderStatus["id"]) {
  return id === "price" ? 1 : id === "disclosure" ? 2 : 3;
}

function buildSourceDetail(providers: ProviderStatus[]) {
  return providers.map((provider) => `${provider.label}: ${provider.detail}`).join(" ");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();
}

function formatYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function fetchWithTimeout(input: URL, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Provider responded with ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}
