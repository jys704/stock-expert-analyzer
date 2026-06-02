import type { IncomingMessage, ServerResponse } from "node:http";

type ProviderState = "connected" | "missing_key" | "fallback" | "error";

function provider(
  id: "price" | "disclosure" | "news",
  label: string,
  state: ProviderState,
  detail: string,
  requiredEnv?: string[],
) {
  return { id, label, state, detail, requiredEnv };
}

function buildSnapshot() {
  const hasDart = Boolean(process.env.DART_API_KEY?.trim());
  const hasNaver = Boolean(process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim());

  const indices = [
    { name: "KOSPI", value: 2792.41, changePct: 0.82, turnoverTn: 9.8, advancers: 512, decliners: 358 },
    { name: "KOSDAQ", value: 874.26, changePct: 1.47, turnoverTn: 7.1, advancers: 827, decliners: 514 },
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

  const stocks = [
    { code: "000660", name: "SK하이닉스", market: "KOSPI", sector: "반도체", theme: "AI 반도체", changePct: 5.42, volumeRatio: 2.4, turnoverBn: 12850, foreignNetBn: 1820, institutionNetBn: 690, programNetBn: 410, news: hasNaver ? "AI 반도체 수요와 HBM 기대감" : "HBM 공급 확대 기대", disclosure: hasDart ? "최근 공시 키 연결됨" : "실적 컨센서스 상향", trendScore: 18, themeRank: 1, sectorRank: 1, riskTags: ["단기 급등"], earlySignal: false },
    { code: "058470", name: "리노공업", market: "KOSDAQ", sector: "반도체", theme: "AI 반도체", changePct: 4.18, volumeRatio: 2.1, turnoverBn: 1420, foreignNetBn: 210, institutionNetBn: 130, programNetBn: 48, news: "AI 테스트 소켓 수요", disclosure: "특이 공시 없음", trendScore: 17, themeRank: 1, sectorRank: 1, riskTags: [], earlySignal: false },
    { code: "267260", name: "HD현대일렉트릭", market: "KOSPI", sector: "전기장비", theme: "전력기기", changePct: 3.72, volumeRatio: 1.9, turnoverBn: 3380, foreignNetBn: 95, institutionNetBn: 340, programNetBn: 62, news: "북미 전력망 투자 기대", disclosure: "수주 잔고 증가", trendScore: 18, themeRank: 2, sectorRank: 2, riskTags: [], earlySignal: false },
    { code: "066970", name: "엘앤에프", market: "KOSDAQ", sector: "2차전지", theme: "2차전지 장비", changePct: 2.12, volumeRatio: 1.7, turnoverBn: 980, foreignNetBn: 74, institutionNetBn: 54, programNetBn: 18, news: "배터리 소재 업황 저점 기대", disclosure: "공급계약 검토 보도", trendScore: 12, themeRank: 3, sectorRank: 4, riskTags: ["업황 변동성"], earlySignal: true },
    { code: "196170", name: "알테오젠", market: "KOSDAQ", sector: "제약·바이오", theme: "바이오 임상", changePct: 3.05, volumeRatio: 1.8, turnoverBn: 2210, foreignNetBn: 160, institutionNetBn: -42, programNetBn: 30, news: "기술이전 기대감", disclosure: "임상 일정 업데이트", trendScore: 15, themeRank: 4, sectorRank: 3, riskTags: ["이벤트 변동성"], earlySignal: true },
    { code: "047810", name: "한국항공우주", market: "KOSPI", sector: "방산", theme: "방산", changePct: 1.62, volumeRatio: 1.5, turnoverBn: 760, foreignNetBn: -18, institutionNetBn: 88, programNetBn: 12, news: "수출 협상 보도", disclosure: "공급계약 기대", trendScore: 11, themeRank: 5, sectorRank: 5, riskTags: [], earlySignal: true },
    { code: "035420", name: "NAVER", market: "KOSPI", sector: "소프트웨어", theme: "AI 서비스", changePct: 0.86, volumeRatio: 1.35, turnoverBn: 1140, foreignNetBn: 122, institutionNetBn: 45, programNetBn: 39, news: "AI 검색 서비스 개편", disclosure: "특이 공시 없음", trendScore: 9, themeRank: 6, sectorRank: 5, riskTags: ["추세 확인 필요"], earlySignal: true },
    { code: "034020", name: "두산에너빌리티", market: "KOSPI", sector: "기계", theme: "원전·전력", changePct: -0.28, volumeRatio: 1.22, turnoverBn: 890, foreignNetBn: 66, institutionNetBn: 31, programNetBn: 9, news: "원전 수주 기대 보도", disclosure: "사업보고서 제출", trendScore: 7, themeRank: 7, sectorRank: 4, riskTags: ["가격 모멘텀 약함"], earlySignal: true },
  ];

  const providers = [
    provider("price", "시세", "fallback", "Vercel 공개 배포에서는 안정적인 샘플 기반 시세를 표시합니다."),
    provider("disclosure", "공시", hasDart ? "connected" : "missing_key", hasDart ? "DART_API_KEY가 Vercel 환경변수에 등록되어 있습니다." : "DART_API_KEY가 없습니다.", ["DART_API_KEY"]),
    provider("news", "뉴스", hasNaver ? "connected" : "missing_key", hasNaver ? "네이버 검색 API 키가 Vercel 환경변수에 등록되어 있습니다." : "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 없습니다.", ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]),
  ];

  return {
    asOf: new Date().toISOString(),
    source: "sample",
    sourceDetail: providers.map((item) => `${item.label}: ${item.detail}`).join(" "),
    providers,
    marketSummary: "코스닥 강도가 우세하고 AI 반도체·전력기기에 수급과 거래대금이 집중됩니다.",
    briefing: "오늘 시장은 코스닥 강도가 코스피보다 우세하며, AI 반도체와 전력기기에 수급과 거래대금이 집중됩니다. 다음 순환 후보는 가격 부담이 낮고 초기 거래량이 늘어난 2차전지 장비, 원전·전력입니다. 추천 3선은 투자 참고용이며, 단기 급등 종목은 분할 접근과 손절 기준을 먼저 정해야 합니다.",
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

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(JSON.stringify(buildSnapshot()));
}
