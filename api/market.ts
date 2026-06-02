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
  source: "sample";
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
  const [disclosureResult, newsResult] = await Promise.allSettled([
    fetchDartDisclosures(base.stocks),
    fetchNaverNews(base.stocks),
  ]);

  let snapshot = base;

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
    { code: "066970", name: "엘앤에프", market: "KOSDAQ", sector: "2차전지", theme: "2차전지 장비", changePct: 2.12, volumeRatio: 1.7, turnoverBn: 980, foreignNetBn: 74, institutionNetBn: 54, programNetBn: 18, news: "배터리 소재 업황 저점 기대", disclosure: "최근 공시 확인 전", trendScore: 12, themeRank: 3, sectorRank: 4, riskTags: ["업황 변동성"], earlySignal: true },
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
