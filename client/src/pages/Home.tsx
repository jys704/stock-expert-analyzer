import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Factory,
  Filter,
  KeyRound,
  LineChart,
  Newspaper,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";

type Market = "KOSPI" | "KOSDAQ";

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

type ProviderStatus = {
  id: "price" | "disclosure" | "news";
  label: string;
  state: "connected" | "missing_key" | "fallback" | "error";
  detail: string;
  requiredEnv?: string[];
};

type ScoreModelItem = {
  label: string;
  max: number;
  rule: string;
};

type MarketSnapshot = {
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

type ScoreBreakdown = {
  supply: number;
  volume: number;
  turnover: number;
  news: number;
  disclosure: number;
  theme: number;
  sector: number;
  trend: number;
  riskPenalty: number;
  total: number;
};

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value);
}

function signed(value: number, unit = "%") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 2)}${unit}`;
}

function getScore(stock: StockSignal): ScoreBreakdown {
  const supply = Math.min(20, Math.max(0, (stock.foreignNetBn > 0 ? 9 : 0) + (stock.institutionNetBn > 0 ? 9 : 0) + (stock.programNetBn > 0 ? 2 : 0)));
  const volume = stock.volumeRatio >= 2 ? 15 : stock.volumeRatio >= 1.7 ? 12 : stock.volumeRatio >= 1.4 ? 9 : stock.volumeRatio >= 1.15 ? 5 : 2;
  const turnover = stock.turnoverBn >= 3000 ? 10 : stock.turnoverBn >= 1000 ? 8 : stock.turnoverBn >= 500 ? 6 : 3;
  const news = stock.news.includes("특이") ? 3 : 10;
  const disclosure = stock.disclosure.includes("특이") ? 3 : 10;
  const theme = Math.max(3, 12 - stock.themeRank * 2);
  const sector = Math.max(3, 12 - stock.sectorRank * 2);
  const trend = stock.trendScore;
  const riskPenalty = Math.min(20, stock.riskTags.length * 5 + (stock.changePct >= 5 ? 5 : 0));
  const total = Math.max(0, Math.min(100, supply + volume + turnover + news + disclosure + theme + sector + trend - riskPenalty));

  return { supply, volume, turnover, news, disclosure, theme, sector, trend, riskPenalty, total };
}

function scoreTone(score: number) {
  if (score >= 82) return "강력 관심";
  if (score >= 70) return "관심";
  if (score >= 58) return "관찰";
  return "보수";
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ko"));
}

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const response = await fetch("/api/market", {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Market API responded with ${response.status}`);
  }

  return response.json() as Promise<MarketSnapshot>;
}

function RankList({ title, items }: { title: string; items: StrengthItem[] }) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <Badge variant="outline" className="h-6 shrink-0 rounded-md border-slate-200 text-[11px] text-slate-500">TOP 5</Badge>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, index) => (
          <div key={item.name} className="grid grid-cols-[24px_1fr_auto] gap-3 px-4 py-3">
            <span className="font-mono text-xs text-slate-400">{index + 1}</span>
            <div>
              <p className="text-sm font-medium text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">{item.flow} · {item.lead}</p>
            </div>
            <div className="text-right">
              <p className={item.changePct >= 0 ? "font-mono text-sm font-semibold text-red-600" : "font-mono text-sm font-semibold text-blue-600"}>{signed(item.changePct)}</p>
              <p className="mt-1 text-[11px] text-slate-400">{item.strength}점</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);

  return (
    <div className="flex h-10 items-end gap-1">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={value >= 0 ? "w-2 rounded-sm bg-red-500" : "w-2 rounded-sm bg-blue-500"}
          style={{ height: `${Math.max(8, (Math.abs(value) / max) * 40)}px` }}
        />
      ))}
    </div>
  );
}

function IndexPanel({ index }: { index: MarketIndex }) {
  const positive = index.changePct >= 0;

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{index.name}</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-slate-950">{formatNumber(index.value, 2)}</p>
        </div>
        <Badge className={positive ? "shrink-0 rounded-md bg-red-50 text-red-700 hover:bg-red-50" : "shrink-0 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-50"}>
          {positive ? <ArrowUp className="mr-1 h-3.5 w-3.5" /> : <ArrowDown className="mr-1 h-3.5 w-3.5" />}
          {signed(index.changePct)}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-slate-400">거래대금</p>
          <p className="mt-1 font-mono font-semibold text-slate-800">{index.turnoverTn}조</p>
        </div>
        <div>
          <p className="text-slate-400">상승</p>
          <p className="mt-1 font-mono font-semibold text-red-600">{index.advancers}</p>
        </div>
        <div>
          <p className="text-slate-400">하락</p>
          <p className="mt-1 font-mono font-semibold text-blue-600">{index.decliners}</p>
        </div>
      </div>
    </div>
  );
}

function MarketPhase({ themes, stocks }: { themes: StrengthItem[]; stocks: StockSignal[] }) {
  const currentThemes = themes.slice(0, 2);
  const nextThemes = themes.slice(2, 4);
  const positiveStocks = stocks.filter((stock) => stock.changePct >= 0).length;
  const volumeLeaders = stocks
    .slice()
    .sort((a, b) => b.volumeRatio - a.volumeRatio)
    .slice(0, 2)
    .map((stock) => `${stock.name} ${stock.volumeRatio.toFixed(1)}배`)
    .join(", ");
  const currentTitle = currentThemes.map((theme) => theme.name).join(" · ") || "데이터 확인 중";
  const nextTitle = nextThemes.map((theme) => theme.name).join(" · ") || "후보 확인 중";
  const currentReasons = [
    currentThemes[0] ? `${currentThemes[0].name}의 상대 강도는 ${currentThemes[0].strength}점, 평균 등락률은 ${signed(currentThemes[0].changePct)}입니다.` : "테마 강도 데이터를 불러오는 중입니다.",
    currentThemes[1] ? `${currentThemes[1].name}도 ${signed(currentThemes[1].changePct)} 흐름으로 상위권을 유지합니다.` : `${positiveStocks}/${stocks.length || 1}개 관심 종목이 플러스권입니다.`,
    volumeLeaders ? `거래량 배수 상위는 ${volumeLeaders}입니다.` : "거래량 배수 데이터를 계산하는 중입니다.",
  ];
  const nextReasons = [
    nextThemes[0] ? `${nextThemes[0].name}은 현재 ${nextThemes[0].strength}점으로 다음 관찰 구간에 있습니다.` : "후순위 테마 데이터가 부족해 보수적으로 관찰합니다.",
    nextThemes[1] ? `${nextThemes[1].name}은 ${signed(nextThemes[1].changePct)} 흐름이라 반등 여부를 확인해야 합니다.` : "테마 확산 여부는 추가 데이터 갱신 후 확인합니다.",
    "후보군은 추격보다 거래량 재증가, 뉴스·공시 신호, 지수 방향을 함께 확인하는 방식으로 봅니다.",
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-md border-red-200 bg-red-50/50 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-950">
            <TrendingUp className="h-5 w-5 text-red-600" />
            현재 강한 장
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{currentTitle}</p>
          <div className="mt-4 space-y-2">
            {currentReasons.map((reason) => (
              <p key={reason} className="flex gap-2 text-sm leading-6 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                {reason}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-blue-200 bg-blue-50/50 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-950">
            <Sparkles className="h-5 w-5 text-blue-600" />
            다음 오를 장 후보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{nextTitle}</p>
          <div className="mt-4 space-y-2">
            {nextReasons.map((reason) => (
              <p key={reason} className="flex gap-2 text-sm leading-6 text-slate-700">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                {reason}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationCard({ stock, rank }: { stock: StockSignal; rank: number }) {
  const score = getScore(stock);

  return (
    <Card className="rounded-md border-slate-200 bg-white shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-slate-400">추천 {rank} · {stock.code}</p>
            <CardTitle className="mt-1 text-xl tracking-[-0.02em] text-slate-950">{stock.name}</CardTitle>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold text-slate-950">{score.total}</p>
            <Badge className="rounded-md bg-slate-950 text-white hover:bg-slate-950">{scoreTone(score.total)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
        <p><span className="font-semibold text-slate-950">추천 사유</span> {stock.theme} 주도 테마 안에서 수급, 거래량, 추세 점수가 함께 높습니다.</p>
        <p><span className="font-semibold text-slate-950">수급 포인트</span> 외국인 {formatNumber(stock.foreignNetBn)}억, 기관 {formatNumber(stock.institutionNetBn)}억, 프로그램 {formatNumber(stock.programNetBn)}억.</p>
        <p><span className="font-semibold text-slate-950">거래 포인트</span> 거래량 {stock.volumeRatio.toFixed(1)}배, 거래대금 {formatNumber(stock.turnoverBn)}억.</p>
        <p><span className="font-semibold text-slate-950">뉴스·공시</span> {stock.news} · {stock.disclosure}</p>
        <p className="flex gap-2 text-amber-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          리스크: {stock.riskTags.length ? stock.riskTags.join(", ") : "명확한 단기 위험 신호는 적지만 시장 변동성 확인 필요"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const snapshotQuery = useQuery({
    queryKey: ["market-snapshot"],
    queryFn: fetchMarketSnapshot,
    refetchInterval: 60_000,
  });
  const [market, setMarket] = useState<"전체" | Market>("전체");
  const [theme, setTheme] = useState("전체");
  const [jointBuying, setJointBuying] = useState(false);
  const [volumeSpike, setVolumeSpike] = useState(false);
  const [issueIncluded, setIssueIncluded] = useState(false);
  const [query, setQuery] = useState("");

  const snapshot = snapshotQuery.data;
  const marketIndices = snapshot?.indices ?? [];
  const themes = snapshot?.themes ?? [];
  const sectors = snapshot?.sectors ?? [];
  const stocks: StockSignal[] = snapshot?.stocks ?? [];
  const scoreModel = snapshot?.scoreModel ?? [];
  const marketSummary = snapshot?.marketSummary ?? "시장 데이터를 불러오는 중입니다.";
  const briefing = snapshot?.briefing ?? "시장 데이터를 불러오는 중입니다.";
  const sourceDetail = snapshot?.sourceDetail ?? "시장 데이터를 불러오는 중입니다.";
  const providers = snapshot?.providers ?? [];
  const dataTime = snapshot?.asOf
    ? new Date(snapshot.asOf).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "불러오는 중";

  const themeOptions = useMemo(() => ["전체", ...unique(stocks.map((stock) => stock.theme))], [stocks]);
  const rankedStocks = useMemo(
    () => stocks.map((stock) => ({ stock, score: getScore(stock) })).sort((a, b) => b.score.total - a.score.total),
    [stocks],
  );
  const recommendations = rankedStocks.slice(0, 3).map((item) => item.stock);

  const filteredStocks = useMemo(() => {
    return rankedStocks
      .filter(({ stock }) => market === "전체" || stock.market === market)
      .filter(({ stock }) => theme === "전체" || stock.theme === theme)
      .filter(({ stock }) => !jointBuying || (stock.foreignNetBn > 0 && stock.institutionNetBn > 0))
      .filter(({ stock }) => !volumeSpike || stock.volumeRatio >= 1.5)
      .filter(({ stock }) => !issueIncluded || !stock.news.includes("특이") || !stock.disclosure.includes("특이"))
      .filter(({ stock }) => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return true;
        return `${stock.name} ${stock.code} ${stock.sector} ${stock.theme}`.toLowerCase().includes(keyword);
      });
  }, [issueIncluded, jointBuying, market, query, rankedStocks, theme, volumeSpike]);

  return (
    <main className="min-h-screen w-screen max-w-full overflow-x-hidden bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl md:text-4xl">한국 주식 강세장 분석</h1>
            <p className="mt-2 max-w-[calc(100vw-2rem)] break-words text-sm leading-6 text-slate-500 md:max-w-none">코스피·코스닥의 테마, 업종, 수급, 거래량, 뉴스·공시를 100점 강세 점수로 정리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-8 rounded-md border-slate-200 bg-white text-slate-600">데이터 기준 {dataTime}</Badge>
            {snapshot?.source === "sample" ? <Badge variant="outline" className="h-8 rounded-md border-amber-200 bg-amber-50 text-amber-700">샘플 공급자</Badge> : null}
            {snapshot?.source === "yahoo" ? <Badge variant="outline" className="h-8 rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">야후 시세</Badge> : null}
            <Badge className="h-8 rounded-md bg-slate-950 text-white hover:bg-slate-950">투자 참고용</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
        {snapshotQuery.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            시장 데이터를 불러오지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.
          </div>
        ) : null}

        <section className="grid min-w-0 items-start gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
            {marketIndices.map((index) => <IndexPanel key={index.name} index={index} />)}
          </div>
          <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LineChart className="h-5 w-5 text-slate-600" />
                오늘 시장 한줄 해석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-words text-sm leading-7 text-slate-700">{marketSummary}</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <RankList title="오늘 강한 테마" items={themes} />
          <RankList title="오늘 강한 업종" items={sectors} />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {providers.map((provider) => (
            <Card key={provider.id} className="rounded-md border-slate-200 bg-white shadow-none">
              <CardContent className="flex gap-3 p-4">
                <div className={provider.state === "connected" ? "mt-0.5 text-emerald-600" : provider.state === "missing_key" ? "mt-0.5 text-amber-600" : "mt-0.5 text-slate-500"}>
                  {provider.state === "missing_key" ? <KeyRound className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{provider.label}</p>
                    <Badge
                      variant="outline"
                      className={provider.state === "connected" ? "rounded-md border-emerald-200 bg-emerald-50 text-emerald-700" : provider.state === "missing_key" ? "rounded-md border-amber-200 bg-amber-50 text-amber-700" : "rounded-md border-slate-200 text-slate-500"}
                    >
                      {provider.state === "connected" ? "연결됨" : provider.state === "missing_key" ? "키 필요" : provider.state === "fallback" ? "폴백" : "오류"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{provider.detail}</p>
                  {provider.requiredEnv?.length ? (
                    <p className="mt-2 font-mono text-[11px] leading-5 text-slate-500">{provider.requiredEnv.join(" / ")}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-5 w-5 text-slate-600" />
                강세 탐색 필터
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="search">종목·테마 검색</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="예: 반도체" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>시장 선택</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["전체", "KOSPI", "KOSDAQ"] as const).map((item) => (
                    <Button key={item} type="button" variant={market === item ? "default" : "outline"} className="h-9 rounded-md text-xs" onClick={() => setMarket(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>테마·업종 선택</Label>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  {themeOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>

              <Separator />

              <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <Checkbox checked={jointBuying} onCheckedChange={(checked) => setJointBuying(Boolean(checked))} />
                외인·기관 동시 순매수
              </label>
              <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <Checkbox checked={volumeSpike} onCheckedChange={(checked) => setVolumeSpike(Boolean(checked))} />
                거래량 급증 포함
              </label>
              <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <Checkbox checked={issueIncluded} onCheckedChange={(checked) => setIssueIncluded(Boolean(checked))} />
                뉴스·공시 신호 포함
              </label>
            </CardContent>
          </Card>

          <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-slate-600" />
                현재 강세 종목 리스트
              </CardTitle>
              <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500">{filteredStocks.length}개</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">종목명</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">시장</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">업종·테마</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">등락률</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">거래량</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">외인</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">기관</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map(({ stock, score }) => (
                      <tr key={stock.code} className="border-b border-slate-100">
                        <td className="border-b border-slate-100 px-3 py-3">
                          <p className="font-medium text-slate-950">{stock.name}</p>
                          <p className="font-mono text-xs text-slate-400">{stock.code}</p>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500">{stock.market}</Badge>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <p className="text-slate-800">{stock.sector}</p>
                          <p className="text-xs text-slate-500">{stock.theme}</p>
                        </td>
                        <td className={stock.changePct >= 0 ? "border-b border-slate-100 px-3 py-3 text-right font-mono font-semibold text-red-600" : "border-b border-slate-100 px-3 py-3 text-right font-mono font-semibold text-blue-600"}>
                          {signed(stock.changePct)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right font-mono">{stock.volumeRatio.toFixed(1)}x</td>
                        <td className={stock.foreignNetBn >= 0 ? "border-b border-slate-100 px-3 py-3 text-right font-mono text-red-600" : "border-b border-slate-100 px-3 py-3 text-right font-mono text-blue-600"}>{formatNumber(stock.foreignNetBn)}억</td>
                        <td className={stock.institutionNetBn >= 0 ? "border-b border-slate-100 px-3 py-3 text-right font-mono text-red-600" : "border-b border-slate-100 px-3 py-3 text-right font-mono text-blue-600"}>{formatNumber(stock.institutionNetBn)}억</td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right">
                          <div className="ml-auto flex w-28 items-center justify-end gap-2">
                            <Progress value={score.total} className="h-2 w-14" />
                            <span className="font-mono font-semibold">{score.total}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[1fr_360px]">
          <MarketPhase themes={themes} stocks={stocks} />
          <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDollarSign className="h-5 w-5 text-slate-600" />
                100점 강세 점수 모델
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scoreModel.map((item) => (
                  <div key={item.label} className="grid grid-cols-[88px_44px_1fr] gap-3 text-xs leading-5">
                    <span className="font-medium text-slate-900">{item.label}</span>
                    <span className={item.max < 0 ? "font-mono text-blue-600" : "font-mono text-slate-500"}>{item.max > 0 ? `+${item.max}` : item.max}</span>
                    <span className="text-slate-500">{item.rule}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">오늘의 추천 종목 3선</h2>
              <p className="mt-1 text-sm text-slate-500">종합 점수 기반 자동 선별 결과입니다. 확신형 매수 권유가 아닌 투자 참고용입니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <MiniBars values={recommendations.map((stock) => getScore(stock).total)} />
              <span className="text-xs text-slate-400">추천 점수 분포</span>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {recommendations.map((stock, index) => <RecommendationCard key={stock.code} stock={stock} rank={index + 1} />)}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                MVP에 꼭 필요한 기능
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
              <p>시장 요약, 강세 종목 리스트, 핵심 필터, 현재/다음 장세 구분, 추천 3선, 리스크 고지.</p>
              <p>처음 버전은 빠르게 판단하는 대시보드에 집중합니다.</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Factory className="h-5 w-5 text-slate-600" />
                나중에 확장할 기능
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
              <p>실시간 API 연동, 뉴스 감성 분석, 공시 자동 분류, 알림, 포트폴리오 추적, 사용자별 관심종목 저장.</p>
              <p>복잡한 백테스트와 고급 차트는 MVP 이후에 붙이는 편이 좋습니다.</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-slate-950 text-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="h-5 w-5 text-slate-300" />
                AI 자동 브리핑 예시
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              {briefing}
            </CardContent>
          </Card>
        </section>

        <footer className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{sourceDetail} 본 화면의 결과는 매수·매도 지시나 수익 보장을 의미하지 않습니다.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
