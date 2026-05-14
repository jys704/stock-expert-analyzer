/*
 * Design reminder: Swiss International Typographic Style + finance research terminal.
 * Every choice should reinforce a calm research-desk feeling: asymmetric panels, thin rules,
 * high-contrast data hierarchy, restrained colors, tabular numbers, and evidence-first copy.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  UserRound,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { auth, isFirebaseConfigured, missingFirebaseConfig } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663603161049/iMVVUjpiMSfcy5jEZLYd2m/stock-research-terminal-hero-FptkRcjr58rEamejVBjhrZ.webp";
const REPORT_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663603161049/iMVVUjpiMSfcy5jEZLYd2m/stock-analysis-report-panel-gjyyzp3wePvGLDNvP3QVxN.webp";
const CALENDAR_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663603161049/iMVVUjpiMSfcy5jEZLYd2m/keyword-calendar-encyclopedia-AgKwXEuP7DtRTiqMhBWgUn.webp";

const sampleStocks = {
  NVDA: {
    symbol: "NVDA",
    name: "NVIDIA",
    close: 884,
    ma20: 852,
    ma60: 781,
    ma120: 655,
    rsi14: 66,
    volume: 58_200_000,
    vol20: 43_000_000,
    prev20High: 878,
    prev60High: 902,
    dayChangePct: 2.8,
    turnoverBn: 51200,
    keywords: "AI 반도체, 데이터센터, GPU, 실적 모멘텀",
    catalyst: "데이터센터 수요와 AI 인프라 투자 확대가 주요 상승 논리로 작동하는 구간입니다.",
    memo: "강한 추세이나 단기 과열과 실적 기대치 선반영 여부를 함께 확인해야 합니다.",
  },
  AAPL: {
    symbol: "AAPL",
    name: "Apple",
    close: 172,
    ma20: 169,
    ma60: 174,
    ma120: 181,
    rsi14: 49,
    volume: 52_000_000,
    vol20: 61_000_000,
    prev20High: 176,
    prev60High: 191,
    dayChangePct: 0.6,
    turnoverBn: 8944,
    keywords: "스마트폰, 서비스, 자사주, AI 디바이스",
    catalyst: "서비스 매출과 AI 기능 기대가 방어 논리로 작동하지만, 추세 회복 확인은 아직 제한적입니다.",
    memo: "정배열 전환과 거래량 동반 돌파가 나오기 전까지는 관찰 우선으로 분류합니다.",
  },
  MSFT: {
    symbol: "MSFT",
    name: "Microsoft",
    close: 421,
    ma20: 414,
    ma60: 403,
    ma120: 382,
    rsi14: 61,
    volume: 24_000_000,
    vol20: 21_500_000,
    prev20High: 426,
    prev60High: 431,
    dayChangePct: 1.2,
    turnoverBn: 10104,
    keywords: "클라우드, AI 소프트웨어, Copilot, 엔터프라이즈",
    catalyst: "클라우드와 AI 소프트웨어 매출 기대가 중기 추세를 지지하는 모습입니다.",
    memo: "추세는 안정적이나 신고가 돌파 여부와 거래량 확장을 추가 확인해야 합니다.",
  },
};

type StockInput = typeof sampleStocks.NVDA;

type AnalysisResult = {
  score: number;
  grade: string;
  stance: string;
  volumeRatio: number;
  trendAligned: boolean;
  breakout20: boolean;
  breakout60: boolean;
  rsiState: string;
  checks: { label: string; ok: boolean; detail: string }[];
  risks: string[];
  report: string;
  actionPlan: string[];
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

function formatVolume(value: number) {
  if (value >= 100_000_000) return `${formatNumber(value / 100_000_000)}억`;
  if (value >= 10_000) return `${formatNumber(value / 10_000)}만`;
  return formatNumber(value);
}

function getAnalysis(input: StockInput): AnalysisResult {
  const close = toNumber(input.close);
  const ma20 = toNumber(input.ma20);
  const ma60 = toNumber(input.ma60);
  const ma120 = toNumber(input.ma120);
  const rsi = toNumber(input.rsi14);
  const volume = toNumber(input.volume);
  const vol20 = toNumber(input.vol20);
  const prev20High = toNumber(input.prev20High);
  const prev60High = toNumber(input.prev60High);
  const dayChangePct = toNumber(input.dayChangePct);
  const turnoverBn = toNumber(input.turnoverBn);
  const keywords = input.keywords.split(",").map((item) => item.trim()).filter(Boolean);
  const volumeRatio = vol20 > 0 ? volume / vol20 : 0;
  const trendAligned = ma20 > ma60 && ma60 > ma120 && close > ma20;
  const breakout20 = close > prev20High;
  const breakout60 = close > prev60High;
  const rsiState = rsi >= 70 ? "과열권" : rsi <= 30 ? "침체권" : rsi >= 55 ? "상승 우위" : rsi <= 45 ? "중립 이하" : "중립";

  let score = 0;
  if (trendAligned) score += 28;
  else if (close > ma20 && ma20 > ma60) score += 20;
  else if (close > ma20) score += 12;
  else score += 5;

  if (breakout60) score += 20;
  else if (breakout20) score += 14;
  else if (close > prev20High * 0.97) score += 7;

  if (volumeRatio >= 1.8) score += 18;
  else if (volumeRatio >= 1.5) score += 14;
  else if (volumeRatio >= 1.1) score += 8;
  else score += 3;

  if (turnoverBn >= 500) score += 12;
  else if (turnoverBn >= 100) score += 7;
  else score += 2;

  if (keywords.length >= 3) score += 10;
  else if (keywords.length >= 1) score += 5;

  if (rsi >= 45 && rsi <= 68) score += 12;
  else if (rsi > 68 && rsi < 75) score += 6;
  else if (rsi <= 35) score += 4;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 82 ? "A" : score >= 68 ? "B" : score >= 52 ? "C" : "D";
  const stance = score >= 82 ? "강한 관심" : score >= 68 ? "관심 유지" : score >= 52 ? "관찰 우선" : "보수적 접근";

  const checks = [
    { label: "정배열·추세", ok: trendAligned, detail: trendAligned ? "MA20 > MA60 > MA120이며 종가가 MA20 위에 있습니다." : "완전한 정배열 또는 종가의 MA20 상회 조건이 약합니다." },
    { label: "20일 고점 돌파", ok: breakout20, detail: breakout20 ? "단기 박스 상단을 돌파했습니다." : "단기 박스 상단 돌파 확인이 필요합니다." },
    { label: "60일 고점 돌파", ok: breakout60, detail: breakout60 ? "중기 매물대를 돌파한 신호로 해석할 수 있습니다." : "중기 고점 돌파 전에는 추격 매수 근거가 약합니다." },
    { label: "거래량 급증", ok: volumeRatio >= 1.5, detail: `20일 평균 대비 ${volumeRatio.toFixed(2)}배 거래되었습니다.` },
    { label: "거래대금 관심", ok: turnoverBn >= 500, detail: turnoverBn >= 500 ? "500억 이상 거래대금 기준을 충족합니다." : "유튜브 요약 자료의 거래대금 기준에는 미달합니다." },
    { label: "테마 키워드", ok: keywords.length >= 3, detail: keywords.length >= 3 ? "키워드가 3개 이상으로 주도 테마 추적에 유리합니다." : "키워드가 적어 개별 이슈인지 추가 확인이 필요합니다." },
  ];

  const risks = [];
  if (rsi >= 70) risks.push("RSI가 70 이상이면 단기 과열로 인한 눌림 가능성을 먼저 고려해야 합니다.");
  if (!breakout20) risks.push("20일 고점 돌파가 확인되지 않아 매수 타이밍은 성급할 수 있습니다.");
  if (volumeRatio < 1.1) risks.push("거래량이 평균 대비 약해 시장 참여자의 확신이 아직 부족합니다.");
  if (dayChangePct >= 10) risks.push("당일 급등폭이 큰 경우 분할 접근과 손절 기준을 먼저 정해야 합니다.");
  if (risks.length === 0) risks.push("명확한 단기 위험 신호는 적지만, 실적·뉴스·시장지수 변동은 별도로 확인해야 합니다.");

  const report = `${input.name || input.symbol}(${input.symbol})는 현재 ${stance} 등급으로 분류됩니다. 기술적으로는 ${trendAligned ? "이동평균선 정배열이 확인되어 중기 추세가 우호적" : "이동평균선 배열이 완전히 정리되지 않아 추세 확인이 더 필요한"} 상황입니다. ${breakout20 ? "20일 고점 돌파가 나타나 단기 수급 유입 가능성을 보여주며" : "20일 고점 돌파가 아직 확인되지 않았고"}, 거래량은 20일 평균 대비 ${volumeRatio.toFixed(2)}배입니다. 유튜브 요약 자료의 핵심인 ‘급등 종목 쉐도잉’과 ‘거래대금 500억 이상 관찰’ 관점에서는 ${turnoverBn >= 500 ? "거래대금 조건을 충족하므로 키워드와 상승 이유를 기록할 가치가 큽니다" : "거래대금 조건이 약하므로 개별 이슈와 시장 확산성을 더 확인해야 합니다"}. 핵심 키워드는 ${keywords.join(" · ") || "미입력"}이며, 이 키워드가 다른 종목으로 확산되는지 관찰하는 것이 다음 단계입니다.`;

  const actionPlan = [
    "매수 전에는 이 종목의 상승 이유를 한 문장으로 정리하고, 같은 키워드로 움직이는 2개 이상의 종목을 함께 확인합니다.",
    "전일 고점, 20일선, 최근 거래량 급증일의 저가 중 하나를 기준으로 손절선을 먼저 정합니다.",
    "키워드 캘린더에는 날짜, 키워드, 등락률, 거래대금, 상승 이유를 기록해 테마 지속성을 추적합니다.",
  ];

  return { score, grade, stance, volumeRatio, trendAligned, breakout20, breakout60, rsiState, checks, risks, report, actionPlan };
}

function MiniChart({ input }: { input: StockInput }) {
  const close = toNumber(input.close);
  const ma20 = toNumber(input.ma20);
  const ma60 = toNumber(input.ma60);
  const ma120 = toNumber(input.ma120);
  const prev20 = toNumber(input.prev20High);
  const prev60 = toNumber(input.prev60High);
  const values = [ma120, ma60, ma20, prev20, prev60, close].filter((v) => v > 0);
  const min = Math.min(...values) * 0.97;
  const max = Math.max(...values) * 1.03;
  const y = (v: number) => 165 - ((v - min) / (max - min || 1)) * 130;
  const path = [ma120, ma60, ma20, prev20, close].map((v, idx) => `${idx === 0 ? "M" : "L"} ${28 + idx * 78} ${y(v)}`).join(" ");

  return (
    <svg viewBox="0 0 380 190" className="h-48 w-full overflow-visible">
      {[0, 1, 2, 3].map((line) => <line key={line} x1="20" x2="360" y1={35 + line * 38} y2={35 + line * 38} stroke="rgba(42,38,31,.12)" strokeWidth="1" />)}
      {[0, 1, 2, 3, 4].map((line) => <line key={line} y1="28" y2="170" x1={34 + line * 78} x2={34 + line * 78} stroke="rgba(42,38,31,.08)" strokeWidth="1" />)}
      <path d={path} fill="none" stroke="#2f6b4f" strokeWidth="3" strokeLinecap="round" />
      <path d={`M 28 ${y(ma120)} L 340 ${y(ma120)}`} stroke="#b08a43" strokeDasharray="6 6" strokeWidth="1.6" />
      <path d={`M 28 ${y(prev60)} L 340 ${y(prev60)}`} stroke="#a84b3f" strokeDasharray="3 7" strokeWidth="1.4" />
      {[ma120, ma60, ma20, prev20, close].map((v, idx) => <circle key={idx} cx={28 + idx * 78} cy={y(v)} r="4" fill={idx === 4 ? "#1f352c" : "#f7f0df"} stroke="#2f6b4f" strokeWidth="2" />)}
      <text x="25" y="185" className="fill-stone-500 text-[10px]">MA120</text>
      <text x="325" y="185" className="fill-stone-700 text-[10px]">현재가</text>
    </svg>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-l border-stone-300 pl-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-stone-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-stone-500">{sub}</p> : null}
    </div>
  );
}

function FirebaseSetupNotice() {
  return (
    <div className="rounded-none border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      <p className="font-semibold">Firebase 설정값이 아직 연결되지 않았습니다.</p>
      <p className="mt-2">개인 Firebase 프로젝트에서 웹앱 설정값을 복사해 `.env` 파일에 입력한 뒤 다시 빌드하거나 실행해야 로그인할 수 있습니다.</p>
      <div className="mt-3 grid gap-1 font-mono text-xs">
        {missingFirebaseConfig.map((key) => <span key={key}>누락: {key}</span>)}
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth) {
      setError("Firebase 설정값을 먼저 연결해야 합니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success("로그인되었습니다.");
    } catch (err) {
      setError("로그인에 실패했습니다. 이메일, 비밀번호, Firebase Authentication 사용자 등록 상태를 확인하세요.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!auth || !email.trim()) {
      setError("비밀번호 재설정을 받으려면 이메일을 먼저 입력하세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("비밀번호 재설정 메일을 보냈습니다.");
    } catch (err) {
      setError("재설정 메일 발송에 실패했습니다. Firebase 사용자 등록 상태를 확인하세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#111411] text-stone-100">
      <section className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
        <div className="relative flex items-end overflow-hidden p-8 md:p-12">
          <img src={HERO_IMAGE} alt="주식 리서치 데스크 배경" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111411] via-[#111411]/80 to-[#111411]/25" />
          <div className="relative max-w-2xl pb-10">
            <Badge className="mb-5 bg-emerald-900/70 text-emerald-100 hover:bg-emerald-900/70">Firebase Authentication</Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] md:text-6xl">주식 투자 전문가형 분석 데스크</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-300">각 사용자가 자기 Firebase 프로젝트에 등록된 개별 계정으로 로그인하고, 분석 리포트를 PDF로 저장할 수 있는 독립형 앱입니다.</p>
          </div>
        </div>
        <div className="flex items-center justify-center bg-[#f7f0df] p-6 text-stone-900">
          <Card className="w-full max-w-md border-stone-300 bg-[#fffaf0] shadow-2xl shadow-black/10">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center border border-stone-300 bg-stone-900 text-stone-50"><Lock className="h-5 w-5" /></div>
              <CardTitle className="text-2xl tracking-[-0.03em]">개별 사용자 로그인</CardTitle>
              <p className="text-sm leading-6 text-stone-600">Firebase Console의 Authentication 메뉴에서 등록한 사용자만 이메일과 비밀번호로 접근할 수 있습니다.</p>
            </CardHeader>
            <CardContent>
              {!isFirebaseConfigured ? <FirebaseSetupNotice /> : null}
              <form onSubmit={submit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" className="border-stone-300 bg-white" autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Firebase 사용자 비밀번호" className="border-stone-300 bg-white" autoComplete="current-password" />
                </div>
                {error ? <p className="text-sm leading-6 text-red-700">{error}</p> : null}
                <Button type="submit" disabled={busy || !isFirebaseConfigured} className="w-full bg-stone-900 text-stone-50 hover:bg-stone-800">분석 데스크 열기</Button>
                <Button type="button" variant="ghost" disabled={busy || !isFirebaseConfigured} onClick={resetPassword} className="w-full text-stone-600">비밀번호 재설정 메일 보내기</Button>
              </form>
              <p className="mt-5 text-xs leading-5 text-stone-500">새 사용자는 앱 화면에서 직접 가입하지 않습니다. 관리자가 Firebase Console에서 허용할 사람의 계정을 먼저 만들어 주세요.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [input, setInput] = useState<StockInput>(sampleStocks.NVDA);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [firebaseIdToken, setFirebaseIdToken] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const result = useMemo(() => getAnalysis(input), [input]);
  const utils = trpc.useUtils();
  const savedReports = trpc.analysis.list.useQuery(
    { idToken: firebaseIdToken },
    { enabled: Boolean(firebaseIdToken) },
  );
  const savePdfReport = trpc.analysis.savePdfReport.useMutation({
    onSuccess: async () => {
      if (firebaseIdToken) {
        await utils.analysis.list.invalidate({ idToken: firebaseIdToken });
      }
    },
  });

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setFirebaseIdToken("");
        return;
      }
      nextUser.getIdToken().then(setFirebaseIdToken).catch(() => setFirebaseIdToken(""));
    });
  }, []);

  const update = (key: keyof StockInput, value: string) => {
    setInput((prev) => ({ ...prev, [key]: ["symbol", "name", "keywords", "catalyst", "memo"].includes(key) ? value : toNumber(value) } as StockInput));
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    toast.success("로그아웃되었습니다.");
  };

  const buildPdf = async () => {
    if (!reportRef.current) throw new Error("리포트 영역을 찾을 수 없습니다.");

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#fffaf0",
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const printableHeight = pageHeight - margin * 2;
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      position = margin - (imgHeight - heightLeft);
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= printableHeight;
    }

    return pdf;
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const pdf = await buildPdf();
      const safeSymbol = input.symbol.replace(/[^a-z0-9가-힣_-]/gi, "_") || "stock";
      pdf.save(`${safeSymbol}_분석리포트.pdf`);
      toast.success("PDF 저장을 시작했습니다.");
    } catch (err) {
      toast.error("PDF 생성 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setPdfBusy(false);
    }
  };

  const saveReportToCloud = async () => {
    if (!user?.uid) {
      toast.error("로그인 사용자 정보를 확인할 수 없습니다.");
      return;
    }

    setPdfBusy(true);
    try {
      const pdf = await buildPdf();
      const pdfDataUrl = pdf.output("datauristring");
      const idToken = await user.getIdToken(true);
      setFirebaseIdToken(idToken);
      await savePdfReport.mutateAsync({
        idToken,
        symbol: input.symbol,
        stockName: input.name,
        score: result.score,
        grade: result.grade,
        stance: result.stance,
        report: result.report,
        snapshot: { input, result },
        pdfDataUrl,
      });
      toast.success("리포트가 서버 저장소에 보관되었습니다.");
    } catch (err) {
      toast.error("서버 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPdfBusy(false);
    }
  };

  if (!authReady) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f0df] text-stone-800">로그인 상태를 확인하는 중입니다.</main>;
  }

  if (!user) return <LoginScreen />;

  return (
    <main className="min-h-screen bg-[#f7f0df] text-stone-900">
      <section className="relative overflow-hidden bg-[#111411] text-stone-50">
        <img src={HERO_IMAGE} alt="주식 리서치 데스크" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111411] via-[#111411]/85 to-[#111411]/35" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-10 md:px-8 lg:grid-cols-[1fr_420px] lg:py-16">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-emerald-900/80 text-emerald-100 hover:bg-emerald-900/80"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Firebase 로그인</Badge>
              <Badge variant="outline" className="border-stone-500 text-stone-200"><Mail className="mr-1 h-3.5 w-3.5" /> {user.email}</Badge>
            </div>
            <h1 className="mt-7 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] md:text-6xl">매수 전, 전문가처럼 종목을 해부하는 분석 노트</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">이 앱은 투자 판단을 대신하지 않습니다. 다만 이동평균, 돌파, RSI, 거래량, 거래대금, 테마 키워드를 하나의 리포트로 묶어 ‘왜 지금 봐야 하는가’와 ‘어디서 조심해야 하는가’를 점검하게 해줍니다.</p>
          </div>
          <Card className="border-stone-700/70 bg-stone-950/70 text-stone-100 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg"><Gauge className="h-5 w-5 text-emerald-300" /> 현재 분석 등급</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-6xl font-semibold tracking-[-0.08em]">{result.grade}</p>
                  <p className="mt-2 text-stone-400">{result.stance}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-4xl font-semibold">{result.score}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">score / 100</p>
                </div>
              </div>
              <Progress value={result.score} className="mt-6 h-2" />
              <p className="mt-5 text-sm leading-6 text-stone-400">점수는 추세, 돌파, 거래량, 거래대금, 키워드, RSI를 규칙 기반으로 계산합니다.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-8 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <Card className="border-stone-300 bg-[#fffaf0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><ClipboardList className="h-5 w-5" /> 종목 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(sampleStocks).map((key) => <Button key={key} type="button" variant={input.symbol === key ? "default" : "outline"} onClick={() => setInput(sampleStocks[key as keyof typeof sampleStocks])}>{key}</Button>)}
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>티커</Label><Input value={input.symbol} onChange={(e) => update("symbol", e.target.value.toUpperCase())} /></div>
                <div className="space-y-1.5"><Label>종목명</Label><Input value={input.name} onChange={(e) => update("name", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>현재가</Label><Input type="number" value={input.close} onChange={(e) => update("close", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>등락률(%)</Label><Input type="number" value={input.dayChangePct} onChange={(e) => update("dayChangePct", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>MA20</Label><Input type="number" value={input.ma20} onChange={(e) => update("ma20", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>MA60</Label><Input type="number" value={input.ma60} onChange={(e) => update("ma60", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>MA120</Label><Input type="number" value={input.ma120} onChange={(e) => update("ma120", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>RSI14</Label><Input type="number" value={input.rsi14} onChange={(e) => update("rsi14", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>거래량</Label><Input type="number" value={input.volume} onChange={(e) => update("volume", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>20일 평균 거래량</Label><Input type="number" value={input.vol20} onChange={(e) => update("vol20", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>직전 20일 고가</Label><Input type="number" value={input.prev20High} onChange={(e) => update("prev20High", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>직전 60일 고가</Label><Input type="number" value={input.prev60High} onChange={(e) => update("prev60High", e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>거래대금(억원)</Label><Input type="number" value={input.turnoverBn} onChange={(e) => update("turnoverBn", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>테마 키워드</Label><Textarea value={input.keywords} onChange={(e) => update("keywords", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>상승 이유·뉴스 메모</Label><Textarea value={input.catalyst} onChange={(e) => update("catalyst", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>개인 메모</Label><Textarea value={input.memo} onChange={(e) => update("memo", e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card className="border-stone-300 bg-[#fffaf0]">
            <CardContent className="space-y-3 p-4 text-sm text-stone-600">
              <div className="flex items-center gap-2 font-medium text-stone-900"><UserRound className="h-4 w-4" /> 로그인 사용자</div>
              <p className="font-mono text-xs">{user.email}</p>
              <Button variant="outline" className="w-full border-stone-300" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /> 로그아웃</Button>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <div ref={reportRef} className="space-y-6 bg-[#f7f0df] p-0">
            <Card className="border-stone-300 bg-[#fffaf0]">
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_.9fr]">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm uppercase tracking-[0.22em] text-stone-500">{input.symbol}</p>
                      <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{input.name}</h2>
                    </div>
                    <Badge className={result.score >= 68 ? "bg-emerald-800 text-white" : "bg-stone-800 text-white"}>{result.stance}</Badge>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
                    <Metric label="현재가" value={formatNumber(input.close)} sub={`${input.dayChangePct}%`} />
                    <Metric label="거래량 배수" value={`${result.volumeRatio.toFixed(2)}x`} sub={`${formatVolume(input.volume)}주`} />
                    <Metric label="RSI14" value={String(input.rsi14)} sub={result.rsiState} />
                    <Metric label="거래대금" value={`${formatNumber(input.turnoverBn)}억`} sub="관심 기준 500억" />
                  </div>
                  <div className="mt-6"><MiniChart input={input} /></div>
                </div>
                <div className="rounded-none border border-stone-300 bg-white/55 p-5">
                  <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-5 w-5 text-emerald-800" /> 전문가형 요약 리포트</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-700">{result.report}</p>
                  <div className="mt-5 rounded-none border-l-4 border-stone-900 bg-[#f7f0df] p-4 text-sm leading-6 text-stone-700">{input.catalyst}</div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-stone-300 bg-[#fffaf0]">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5" /> 분석 체크리스트</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {result.checks.map((check) => (
                    <div key={check.label} className="grid grid-cols-[24px_1fr] gap-3 border-t border-stone-200 pt-3">
                      {check.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />}
                      <div><p className="font-medium">{check.label}</p><p className="mt-1 text-sm leading-6 text-stone-600">{check.detail}</p></div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-stone-300 bg-[#fffaf0]">
                <img src={REPORT_IMAGE} alt="분석 리포트 이미지" className="h-40 w-full object-cover" />
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5" /> 리스크 노트</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {result.risks.map((risk) => <p key={risk} className="border-l border-red-300 pl-3 text-sm leading-6 text-stone-700">{risk}</p>)}
                  <p className="pt-2 text-sm leading-6 text-stone-600">개인 메모: {input.memo}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-stone-300 bg-[#fffaf0]">
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[.85fr_1fr]">
                <img src={CALENDAR_IMAGE} alt="키워드 캘린더와 백과사전" className="h-full min-h-64 w-full object-cover" />
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.03em]"><CalendarDays className="h-5 w-5" /> 키워드 캘린더·백과사전 기록</h3>
                  <p className="mt-3 text-sm leading-7 text-stone-600">유튜브 요약 자료의 핵심은 급등주와 거래대금 집중 종목을 매일 기록하고, 같은 키워드가 여러 종목으로 확산되는지 확인하는 것입니다. 아래 항목을 복사해 스프레드시트나 노션에 누적하면 자신만의 시장 백과사전이 됩니다.</p>
                  <div className="mt-5 space-y-3">
                    {result.actionPlan.map((item, index) => <div key={item} className="flex gap-3 text-sm leading-6"><span className="font-mono text-stone-400">0{index + 1}</span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-500" /><span>{item}</span></div>)}
                  </div>
                  <div className="mt-6 rounded-none border border-stone-300 bg-white/60 p-4 font-mono text-xs leading-6 text-stone-700">
                    날짜 / {input.symbol} / {input.keywords || "키워드"} / 등락률 {input.dayChangePct}% / 거래대금 {formatNumber(input.turnoverBn)}억 / 점수 {result.score}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-stone-300 bg-[#fffaf0]">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold"><Download className="h-5 w-5" /> 리포트 PDF 저장·서버 보관</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">현재 입력값과 분석 결과를 PDF로 만들고, 필요하면 서버 파일 저장소와 데이터베이스에 함께 보관합니다.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={downloadPdf} disabled={pdfBusy || savePdfReport.isPending} variant="outline" className="border-stone-300"><Download className="mr-2 h-4 w-4" /> 로컬 PDF 저장</Button>
                <Button onClick={saveReportToCloud} disabled={pdfBusy || savePdfReport.isPending} className="bg-stone-900 text-stone-50 hover:bg-stone-800"><UploadCloud className="mr-2 h-4 w-4" /> {savePdfReport.isPending ? "서버 저장 중" : "서버에 저장"}</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-300 bg-[#fffaf0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" /> 저장된 리포트</CardTitle>
              <p className="text-sm leading-6 text-stone-600">서버 파일 저장소에는 PDF 원본이, 데이터베이스에는 종목·점수·파일 URL 메타데이터가 저장됩니다.</p>
            </CardHeader>
            <CardContent>
              {savedReports.isLoading ? (
                <p className="text-sm text-stone-500">저장 목록을 불러오는 중입니다.</p>
              ) : savedReports.data?.length ? (
                <div className="divide-y divide-stone-200 border-y border-stone-200">
                  {savedReports.data.map((report) => (
                    <div key={report.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{report.symbol} · {new Date(report.createdAt).toLocaleString()}</p>
                        <p className="mt-1 font-semibold text-stone-900">{report.stockName} / {report.grade}등급 / {report.score}점</p>
                        <p className="mt-1 text-sm text-stone-600">{report.stance}</p>
                      </div>
                      <Button asChild variant="outline" className="w-fit border-stone-300">
                        <a href={report.fileUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> PDF 열기</a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-none border border-dashed border-stone-300 p-5 text-sm leading-6 text-stone-600">아직 서버에 저장된 리포트가 없습니다. 상단의 “서버에 저장” 버튼을 누르면 이 영역에 PDF 링크가 표시됩니다.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-stone-300 bg-stone-900 text-stone-100">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5" /> 투자 참고 고지</h3>
                <p className="mt-2 text-sm leading-6 text-stone-400">본 앱의 결과는 교육·정리용 참고 자료이며, 매수·매도 추천이나 수익 보장을 의미하지 않습니다. 실제 투자는 본인의 책임으로 판단해야 합니다.</p>
              </div>
              <Badge variant="outline" className="w-fit border-stone-600 text-stone-300">Firebase Auth · PDF Export · Portable</Badge>
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
