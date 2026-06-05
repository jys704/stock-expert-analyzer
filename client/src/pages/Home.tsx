import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Factory,
  Filter,
  Globe2,
  KeyRound,
  LineChart,
  Newspaper,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
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
  disclosureTone: "positive" | "watch" | "neutral";
  disclosureScore: number;
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

type BreakingNewsItem = {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
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
  scoreModel?: Array<{ label: string; max: number; rule: string }>;
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

type RiskAlert = {
  stock: StockSignal;
  severity: "critical" | "high" | "watch";
  score: number;
  reasons: string[];
  watched: boolean;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const WATCHLIST_STORAGE_KEY = "stock-expert-analyzer.watchlist.v1";

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value);
}

function signed(value: number, unit = "%") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 2)}${unit}`;
}

function numeric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function averageNumber(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatFlow(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}억`;
}

function flowTone(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "border-b border-slate-100 px-3 py-3 text-right font-mono text-slate-400";
  return value >= 0
    ? "border-b border-slate-100 px-3 py-3 text-right font-mono text-red-600"
    : "border-b border-slate-100 px-3 py-3 text-right font-mono text-blue-600";
}

function disclosureBadgeClass(tone: StockSignal["disclosureTone"]) {
  if (tone === "positive") return "rounded-md border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "watch") return "rounded-md border-amber-200 bg-amber-50 text-amber-700";
  return "rounded-md border-slate-200 bg-white text-slate-500";
}

function getScore(stock: StockSignal): ScoreBreakdown {
  const foreignNetBn = numeric(stock.foreignNetBn);
  const institutionNetBn = numeric(stock.institutionNetBn);
  const programNetBn = numeric(stock.programNetBn);
  const supply = Math.min(20, Math.max(0, (foreignNetBn > 0 ? 9 : 0) + (institutionNetBn > 0 ? 9 : 0) + (programNetBn > 0 ? 2 : 0)));
  const volume = stock.volumeRatio >= 2 ? 15 : stock.volumeRatio >= 1.7 ? 12 : stock.volumeRatio >= 1.4 ? 9 : stock.volumeRatio >= 1.15 ? 5 : 2;
  const turnover = stock.turnoverBn >= 3000 ? 10 : stock.turnoverBn >= 1000 ? 8 : stock.turnoverBn >= 500 ? 6 : 3;
  const news = stock.news.includes("특이") ? 3 : 10;
  const disclosure = Math.max(2, Math.min(10, 5 + stock.disclosureScore));
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

function providerStatusLabel(provider: ProviderStatus) {
  if (provider.state === "connected") return `${provider.label} 연결`;
  if (provider.state === "missing_key") return `${provider.label} 키 필요`;
  if (provider.state === "error") return `${provider.label} 오류`;
  return `${provider.label} 대기`;
}

function providerStatusClass(provider: ProviderStatus) {
  if (provider.state === "connected") return "rounded-md border-emerald-200 bg-emerald-50 text-emerald-700";
  if (provider.state === "missing_key") return "rounded-md border-amber-200 bg-amber-50 text-amber-700";
  if (provider.state === "error") return "rounded-md border-red-200 bg-red-50 text-red-700";
  return "rounded-md border-slate-200 bg-white text-slate-500";
}

function riskSeverityClass(severity: RiskAlert["severity"]) {
  if (severity === "critical") return "rounded-md border-red-200 bg-red-50 text-red-700";
  if (severity === "high") return "rounded-md border-amber-200 bg-amber-50 text-amber-700";
  return "rounded-md border-slate-200 bg-white text-slate-600";
}

function riskSeverityLabel(severity: RiskAlert["severity"]) {
  if (severity === "critical") return "긴급";
  if (severity === "high") return "주의";
  return "관찰";
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ko"));
}

function readSavedWatchlist() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildRiskAlerts(stocks: StockSignal[], watchlist: Set<string>): RiskAlert[] {
  return stocks
    .map((stock) => {
      const reasons: string[] = [];
      let score = 0;
      const foreignNetBn = numeric(stock.foreignNetBn);
      const institutionNetBn = numeric(stock.institutionNetBn);

      if (stock.disclosureTone === "watch") {
        score += 36;
        reasons.push(`${stock.disclosureCategory} 공시`);
      }
      if (stock.changePct <= -7) {
        score += 34;
        reasons.push(`급락 ${signed(stock.changePct)}`);
      } else if (stock.changePct <= -4) {
        score += 22;
        reasons.push(`약세 ${signed(stock.changePct)}`);
      }
      if (stock.changePct >= 8) {
        score += 22;
        reasons.push(`단기 과열 ${signed(stock.changePct)}`);
      }
      if (stock.volumeRatio >= 5) {
        score += 18;
        reasons.push(`거래 집중 ${stock.volumeRatio.toFixed(1)}x`);
      }
      if (foreignNetBn < 0 && institutionNetBn < 0) {
        score += 16;
        reasons.push("외국인·기관 동반 매도");
      }
      if (stock.riskTags.length) {
        score += Math.min(18, stock.riskTags.length * 6);
        reasons.push(...stock.riskTags.slice(0, 2));
      }

      if (watchlist.has(stock.code)) score += 12;

      const severity: RiskAlert["severity"] = score >= 55 ? "critical" : score >= 32 ? "high" : "watch";

      return {
        stock,
        severity,
        score,
        reasons: Array.from(new Set(reasons)).slice(0, 3),
        watched: watchlist.has(stock.code),
      };
    })
    .filter((alert) => alert.score >= 24 && alert.reasons.length > 0)
    .sort((a, b) => {
      if (a.watched !== b.watched) return a.watched ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 10);
}

function formatNewsTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금 전";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchMarketSnapshot(forceRefresh = false): Promise<MarketSnapshot> {
  const response = await fetch(forceRefresh ? "/api/market?refresh=1" : "/api/market", {
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

function BreakingNewsPanel({ items, providers }: { items: BreakingNewsItem[]; providers: ProviderStatus[] }) {
  return (
    <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-5 w-5 text-slate-600" />
            실시간 뉴스·속보
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {providers.map((provider) => (
              <Badge key={provider.id} variant="outline" className={providerStatusClass(provider)}>
                {provider.state === "missing_key" ? <KeyRound className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                {providerStatusLabel(provider)}
              </Badge>
            ))}
            <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500">{items.length ? "오늘/최근 우선" : "대기 중"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {items.slice(0, 8).map((item) => (
              <a
                key={`${item.url}-${item.publishedAt}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-slate-100 p-3 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-slate-500">{item.source}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">{formatNewsTime(item.publishedAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-950">{item.title}</p>
                {item.summary ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p> : null}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500">네이버 뉴스 API 키가 연결되면 최신 증시 뉴스가 자동으로 표시됩니다.</p>
        )}
      </CardContent>
    </Card>
  );
}

function MarketBoard({
  domestic,
  global,
  themes,
  summary,
}: {
  domestic: MarketIndex[];
  global: GlobalIndex[];
  themes: StrengthItem[];
  summary: string;
}) {
  const kospi = domestic.find((index) => index.name === "KOSPI");
  const kosdaq = domestic.find((index) => index.name === "KOSDAQ");
  const overseasTone = global.length ? averageNumber(global.map((index) => index.changePct)) : 0;
  const leadingTheme = themes[0]?.name ?? "확인 중";

  return (
    <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="h-5 w-5 text-slate-600" />
          시장 게시판
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">국내 흐름</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">
            KOSPI {kospi ? signed(kospi.changePct) : "확인 중"}, KOSDAQ {kosdaq ? signed(kosdaq.changePct) : "확인 중"}.
            주도 테마는 {leadingTheme}입니다.
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">해외 흐름</p>
          <p className={overseasTone >= 0 ? "mt-2 font-mono text-lg font-semibold text-red-600" : "mt-2 font-mono text-lg font-semibold text-blue-600"}>
            {signed(overseasTone)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">미국·일본·중국 주요 지수 평균 등락률 기준</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">주요 해외 지수</p>
          <div className="mt-2 space-y-2">
            {global.slice(0, 6).map((index) => (
              <div key={`${index.region}-${index.name}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{index.name}</p>
                  <p className="text-xs text-slate-400">{index.region}</p>
                </div>
                <div className="text-right">
                  <p className={index.changePct >= 0 ? "font-mono font-semibold text-red-600" : "font-mono font-semibold text-blue-600"}>{signed(index.changePct)}</p>
                  <p className="font-mono text-[11px] text-slate-400">{index.value ? formatNumber(index.value, 2) : "대기"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Separator />
        <p className="text-xs leading-6 text-slate-500">{summary}</p>
      </CardContent>
    </Card>
  );
}

function RiskAlertPanel({ alerts, watchlistCount }: { alerts: RiskAlert[]; watchlistCount: number }) {
  return (
    <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          고급 리스크 경보
        </CardTitle>
        <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500">관심 {watchlistCount}개</Badge>
      </CardHeader>
      <CardContent>
        {alerts.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {alerts.map((alert) => (
              <div key={alert.stock.code} className="rounded-md border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{alert.stock.name}</p>
                      {alert.watched ? <Star className="h-4 w-4 fill-amber-400 text-amber-500" /> : null}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-400">{alert.stock.code} · {alert.stock.market}</p>
                  </div>
                  <Badge variant="outline" className={riskSeverityClass(alert.severity)}>{riskSeverityLabel(alert.severity)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {alert.reasons.map((reason) => (
                    <Badge key={reason} variant="outline" className="rounded-md border-slate-200 bg-slate-50 text-slate-600">{reason}</Badge>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">등락률</p>
                    <p className={alert.stock.changePct >= 0 ? "mt-1 font-mono font-semibold text-red-600" : "mt-1 font-mono font-semibold text-blue-600"}>{signed(alert.stock.changePct)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">거래량</p>
                    <p className="mt-1 font-mono font-semibold text-slate-800">{alert.stock.volumeRatio.toFixed(1)}x</p>
                  </div>
                  <div>
                    <p className="text-slate-400">위험점수</p>
                    <p className="mt-1 font-mono font-semibold text-slate-800">{alert.score}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500">현재 조건에서 강한 리스크 경보가 없습니다. 관심종목을 저장하면 해당 종목을 우선 감시합니다.</p>
        )}
      </CardContent>
    </Card>
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

function RecommendationCard({
  stock,
  rank,
  watched,
  onToggleWatch,
}: {
  stock: StockSignal;
  rank: number;
  watched: boolean;
  onToggleWatch: (code: string) => void;
}) {
  const score = getScore(stock);
  const hasProgram = typeof stock.programNetBn === "number" && Number.isFinite(stock.programNetBn);

  return (
    <Card className="rounded-md border-slate-200 bg-white shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-slate-400">추천 {rank} · {stock.code}</p>
            <CardTitle className="mt-1 text-xl tracking-[-0.02em] text-slate-950">{stock.name}</CardTitle>
          </div>
          <div className="flex items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => onToggleWatch(stock.code)}
              aria-label={watched ? "관심종목 해제" : "관심종목 저장"}
            >
              <Star className={watched ? "h-4 w-4 fill-amber-400 text-amber-500" : "h-4 w-4 text-slate-400"} />
            </Button>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold text-slate-950">{score.total}</p>
              <Badge className="rounded-md bg-slate-950 text-white hover:bg-slate-950">{scoreTone(score.total)}</Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
        <p><span className="font-semibold text-slate-950">추천 사유</span> {stock.theme} 주도 테마 안에서 수급, 거래량, 추세 점수가 함께 높습니다.</p>
        <p><span className="font-semibold text-slate-950">수급 포인트</span> 외국인 {formatFlow(stock.foreignNetBn)}, 기관 {formatFlow(stock.institutionNetBn)}, 프로그램 {hasProgram ? formatFlow(stock.programNetBn) : "확인 불가"}.</p>
        <p><span className="font-semibold text-slate-950">거래 포인트</span> 거래량 {stock.volumeRatio.toFixed(1)}배, 거래대금 {formatNumber(stock.turnoverBn)}억.</p>
        <div>
          <p><span className="font-semibold text-slate-950">뉴스·공시</span> {stock.news}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={disclosureBadgeClass(stock.disclosureTone)}>{stock.disclosureCategory}</Badge>
            <span className="text-slate-600">{stock.disclosure}</span>
          </div>
        </div>
        <p className="flex gap-2 text-amber-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          리스크: {stock.riskTags.length ? stock.riskTags.join(", ") : "명확한 단기 위험 신호는 적지만 시장 변동성 확인 필요"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const forceRefreshRef = useRef(false);
  const snapshotQuery = useQuery({
    queryKey: ["market-snapshot"],
    queryFn: () => {
      const forceRefresh = forceRefreshRef.current;
      forceRefreshRef.current = false;
      return fetchMarketSnapshot(forceRefresh);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const [market, setMarket] = useState<"전체" | Market>("전체");
  const [theme, setTheme] = useState("전체");
  const [jointBuying, setJointBuying] = useState(false);
  const [volumeSpike, setVolumeSpike] = useState(false);
  const [issueIncluded, setIssueIncluded] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [watchlist, setWatchlist] = useState<string[]>(readSavedWatchlist);

  const snapshot = snapshotQuery.data;
  const marketIndices = snapshot?.indices ?? [];
  const globalIndices = snapshot?.globalIndices ?? [];
  const themes = snapshot?.themes ?? [];
  const sectors = snapshot?.sectors ?? [];
  const stocks: StockSignal[] = snapshot?.stocks ?? [];
  const marketSummary = snapshot?.marketSummary ?? "시장 데이터를 불러오는 중입니다.";
  const briefing = snapshot?.briefing ?? "시장 데이터를 불러오는 중입니다.";
  const sourceDetail = snapshot?.sourceDetail ?? "시장 데이터를 불러오는 중입니다.";
  const providers = snapshot?.providers ?? [];
  const breakingNews = snapshot?.breakingNews ?? [];
  const dataTime = snapshot?.asOf
    ? new Date(snapshot.asOf).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "불러오는 중";
  const handleManualRefresh = () => {
    forceRefreshRef.current = true;
    void snapshotQuery.refetch();
  };
  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);
  const toggleWatchlist = (code: string) => {
    setWatchlist((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      return [...current, code];
    });
  };

  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const themeOptions = useMemo(() => ["전체", ...unique(stocks.map((stock) => stock.theme))], [stocks]);
  const rankedStocks = useMemo(
    () => stocks.map((stock) => ({ stock, score: getScore(stock) })).sort((a, b) => b.score.total - a.score.total),
    [stocks],
  );
  const recommendations = rankedStocks.slice(0, 10).map((item) => item.stock);
  const watchlistStocks = useMemo(
    () => stocks.filter((stock) => watchlistSet.has(stock.code)),
    [stocks, watchlistSet],
  );
  const riskAlerts = useMemo(
    () => buildRiskAlerts(stocks, watchlistSet),
    [stocks, watchlistSet],
  );

  const filteredStocks = useMemo(() => {
    return rankedStocks
      .filter(({ stock }) => !watchlistOnly || watchlistSet.has(stock.code))
      .filter(({ stock }) => market === "전체" || stock.market === market)
      .filter(({ stock }) => theme === "전체" || stock.theme === theme)
      .filter(({ stock }) => !jointBuying || (numeric(stock.foreignNetBn) > 0 && numeric(stock.institutionNetBn) > 0))
      .filter(({ stock }) => !volumeSpike || stock.volumeRatio >= 1.5)
      .filter(({ stock }) => !issueIncluded || !stock.news.includes("특이") || !stock.disclosure.includes("특이"))
      .filter(({ stock }) => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return true;
        return `${stock.name} ${stock.code} ${stock.sector} ${stock.theme}`.toLowerCase().includes(keyword);
      });
  }, [issueIncluded, jointBuying, market, query, rankedStocks, theme, volumeSpike, watchlistOnly, watchlistSet]);
  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = filteredStocks.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filteredStocks.length);
  const pagedStocks = filteredStocks.slice(pageStart > 0 ? pageStart - 1 : 0, pageEnd);
  const visiblePages = getVisiblePages(safePage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [issueIncluded, jointBuying, market, pageSize, query, theme, volumeSpike, watchlistOnly]);

  return (
    <main className="min-h-screen w-screen max-w-full overflow-x-hidden bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl md:text-4xl">한국 주식 강세장 분석</h1>
            <p className="mt-2 max-w-[calc(100vw-2rem)] break-words text-sm leading-6 text-slate-500 md:max-w-none">국내·해외 지수, 테마, 업종, 수급, 거래량, 뉴스·공시를 실시간 대시보드로 정리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-8 rounded-md border-slate-200 bg-white text-slate-600">데이터 기준 {dataTime}</Badge>
            {snapshot?.source === "sample" ? <Badge variant="outline" className="h-8 rounded-md border-amber-200 bg-amber-50 text-amber-700">샘플 공급자</Badge> : null}
            {snapshot?.source === "yahoo" ? <Badge variant="outline" className="h-8 rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">야후 시세</Badge> : null}
            {snapshot?.source === "naver" ? <Badge variant="outline" className="h-8 rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">네이버 시세</Badge> : null}
            <Badge variant="outline" className="h-8 rounded-md border-blue-200 bg-blue-50 text-blue-700">30초 자동 갱신</Badge>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-md px-3 text-xs"
              onClick={handleManualRefresh}
              disabled={snapshotQuery.isFetching}
            >
              <RefreshCw className={snapshotQuery.isFetching ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} />
              새로고침
            </Button>
            <Badge className="h-8 rounded-md bg-slate-950 text-white hover:bg-slate-950">투자 참고용</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 md:px-6">
        {snapshotQuery.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            시장 데이터를 불러오지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.
          </div>
        ) : null}

        <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[320px_1fr]">
          <MarketBoard domestic={marketIndices} global={globalIndices} themes={themes} summary={marketSummary} />
          <div className="grid min-w-0 gap-4">
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[1fr_360px]">
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
            </div>
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <RankList title="오늘 강한 테마" items={themes} />
              <RankList title="오늘 강한 업종" items={sectors} />
            </div>
          </div>
        </section>

        <BreakingNewsPanel items={breakingNews} providers={providers} />

        <section className="grid min-w-0 gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="w-full min-w-0 rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-5 w-5 text-amber-500" />
                내 관심종목
              </CardTitle>
            </CardHeader>
            <CardContent>
              {watchlistStocks.length ? (
                <div className="space-y-2">
                  {watchlistStocks.slice(0, 6).map((stock) => (
                    <div key={stock.code} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">{stock.name}</p>
                        <p className="font-mono text-xs text-slate-400">{stock.code}</p>
                      </div>
                      <div className="text-right">
                        <p className={stock.changePct >= 0 ? "font-mono text-sm font-semibold text-red-600" : "font-mono text-sm font-semibold text-blue-600"}>{signed(stock.changePct)}</p>
                        <Button type="button" variant="ghost" className="h-6 px-2 text-[11px] text-slate-500" onClick={() => toggleWatchlist(stock.code)}>해제</Button>
                      </div>
                    </div>
                  ))}
                  {watchlistStocks.length > 6 ? <p className="text-xs text-slate-500">외 {watchlistStocks.length - 6}개는 관심종목 필터에서 확인할 수 있습니다.</p> : null}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-500">종목 리스트나 추천 카드의 별표를 누르면 이 브라우저에 사용자별 관심종목으로 저장됩니다.</p>
              )}
            </CardContent>
          </Card>
          <RiskAlertPanel alerts={riskAlerts} watchlistCount={watchlist.length} />
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[260px_1fr]">
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
                <Checkbox checked={watchlistOnly} onCheckedChange={(checked) => setWatchlistOnly(Boolean(checked))} />
                관심종목만 보기
              </label>
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
            <CardHeader className="gap-3 pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5 text-slate-600" />
                    현재 강세 종목 리스트
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    {filteredStocks.length ? `${formatNumber(pageStart)}-${formatNumber(pageEnd)}번째 표시` : "표시할 종목 없음"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500">{formatNumber(filteredStocks.length)}/{formatNumber(stocks.length)}개</Badge>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-400"
                    aria-label="페이지당 표시 종목 수"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}개씩</option>)}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">관심</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">종목명</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">시장</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">업종·테마</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-medium">공시</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">등락률</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">거래량</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">외인</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">기관</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStocks.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-500">
                          조건에 맞는 종목이 없습니다. 검색어 또는 필터를 조정해 주세요.
                        </td>
                      </tr>
                    ) : null}
                    {pagedStocks.map(({ stock, score }) => (
                      <tr key={stock.code} className="border-b border-slate-100">
                        <td className="border-b border-slate-100 px-3 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-md"
                            onClick={() => toggleWatchlist(stock.code)}
                            aria-label={watchlistSet.has(stock.code) ? "관심종목 해제" : "관심종목 저장"}
                          >
                            <Star className={watchlistSet.has(stock.code) ? "h-4 w-4 fill-amber-400 text-amber-500" : "h-4 w-4 text-slate-300"} />
                          </Button>
                        </td>
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
                        <td className="border-b border-slate-100 px-3 py-3">
                          <Badge variant="outline" className={disclosureBadgeClass(stock.disclosureTone)}>{stock.disclosureCategory}</Badge>
                        </td>
                        <td className={stock.changePct >= 0 ? "border-b border-slate-100 px-3 py-3 text-right font-mono font-semibold text-red-600" : "border-b border-slate-100 px-3 py-3 text-right font-mono font-semibold text-blue-600"}>
                          {signed(stock.changePct)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right font-mono">{stock.volumeRatio.toFixed(1)}x</td>
                        <td className={flowTone(stock.foreignNetBn)}>{formatFlow(stock.foreignNetBn)}</td>
                        <td className={flowTone(stock.institutionNetBn)}>{formatFlow(stock.institutionNetBn)}</td>
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
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
                <p className="text-xs text-slate-500">
                  총 {formatNumber(totalPages)}페이지 중 {formatNumber(safePage)}페이지
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md"
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage <= 1}
                    aria-label="첫 페이지"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage <= 1}
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {visiblePages.map((page) => (
                    <Button
                      key={page}
                      type="button"
                      variant={safePage === page ? "default" : "outline"}
                      className="h-8 min-w-8 rounded-md px-2 text-xs"
                      onClick={() => setCurrentPage(page)}
                    >
                      {formatNumber(page)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safePage >= totalPages}
                    aria-label="다음 페이지"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage >= totalPages}
                    aria-label="마지막 페이지"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4">
          <MarketPhase themes={themes} stocks={stocks} />
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">오늘의 추천 종목 10선</h2>
              <p className="mt-1 text-sm text-slate-500">종합 점수 기반 자동 선별 10개 종목입니다. 확신형 매수 권유가 아닌 투자 참고용입니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <MiniBars values={recommendations.map((stock) => getScore(stock).total)} />
              <span className="text-xs text-slate-400">추천 점수 분포</span>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((stock, index) => (
              <RecommendationCard
                key={stock.code}
                stock={stock}
                rank={index + 1}
                watched={watchlistSet.has(stock.code)}
                onToggleWatch={toggleWatchlist}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                공개 전 안정화
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
              <p>시세·공시·뉴스 공급자 상태, 최신성, 장애 시 폴백 안내를 명확히 표시합니다.</p>
              <p>실시간 참고 사이트로 공개하려면 데이터 출처와 지연 가능성을 항상 보여주는 것이 중요합니다.</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Factory className="h-5 w-5 text-slate-600" />
                다음 개발 단계
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
              <p>회원별 관심종목 동기화, 알림, 포트폴리오 추적, 공시 중요도 자동 분류를 순서대로 붙입니다.</p>
              <p>차트·백테스트는 데이터 안정화 후 붙이는 것이 운영 리스크가 낮습니다.</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-slate-950 text-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="h-5 w-5 text-slate-300" />
                AI 자동 브리핑
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              {briefing}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="text-sm font-semibold text-slate-950">서비스화 Plan</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">사람들이 참고할 수 있는 공개 사이트로 키우기 위한 다음 순서입니다.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["1단계", "데이터 신뢰도", "시세·공시·뉴스 수집 로그와 장애 안내를 관리자 화면에서 확인"],
                ["2단계", "사용자 기능", "로그인, 관심종목 동기화, 리스크 알림, 개인 대시보드"],
                ["3단계", "콘텐츠화", "장마감 브리핑, 주간 리포트, 공시 요약, 교육형 가이드"],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-md border border-slate-100 bg-slate-50 p-4">
                  <p className="font-mono text-xs text-slate-400">{step}</p>
                  <p className="mt-1 font-semibold text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
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
