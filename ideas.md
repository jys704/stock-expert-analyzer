# 디자인 브레인스토밍

<response>
<text>
<idea>
**Design Movement**: Swiss International Typographic Style와 금융 터미널 미학의 결합.

**Core Principles**: 정보 위계가 먼저이고 장식은 뒤따른다. 숫자와 판단 근거는 좌우 비대칭 패널에 배치한다. 투자 판단의 긴장감을 낮추기 위해 여백은 넓게 두되, 핵심 지표는 높은 대비로 고정한다. 카드의 모서리는 최소화하고 선, 축, 구획선을 질서 있게 사용한다.

**Color Philosophy**: 짙은 잉크색, 장부지 베이지, 절제된 상승 녹색과 위험 적색을 사용한다. 색상은 감정을 과장하기보다 ‘감사 보고서’처럼 신뢰와 검토 가능성을 주는 역할을 한다.

**Layout Paradigm**: 중앙 정렬 랜딩이 아니라 왼쪽에는 분석 입력과 체크리스트, 오른쪽에는 리포트·차트·판단 요약이 놓이는 비대칭 리서치 데스크 구조를 사용한다.

**Signature Elements**: 얇은 축선, 종이 리포트 같은 섹션 번호, 터미널형 지표 배지를 반복한다.

**Interaction Philosophy**: 사용자가 입력을 바꾸면 과장된 반응이 아니라 보고서가 갱신되는 느낌으로 조용히 전환된다.

**Animation**: 패널은 160~220ms의 짧은 opacity와 translate 전환을 사용한다. 점수 막대는 왼쪽에서 오른쪽으로 차분히 채워지고, 위험 문구는 깜빡임 없이 미세한 색상 변화만 준다.

**Typography System**: 제목은 Pretendard Variable 또는 Noto Sans KR의 굵은 산세리프, 숫자와 티커는 ui-monospace 계열을 사용한다. 본문은 Noto Sans KR 15~16px로 안정적인 가독성을 유지한다.
</idea>
</text>
<probability>0.07</probability>
</response>

<response>
<text>
<idea>
**Design Movement**: Neo-Brutalist Spreadsheet.

**Core Principles**: 스프레드시트의 날것 같은 판단 흐름을 앱 인터페이스로 확장한다. 굵은 테두리, 명확한 셀, 원색 경고 태그를 사용한다. 사용자는 분석 결과를 ‘예쁘게 감상’하기보다 빠르게 판정하고 기록한다.

**Color Philosophy**: 흰색 바탕에 검정 테두리, 노란 메모지, 빨간 위험 마크, 파란 링크색을 사용해 학습 노트의 감각을 만든다.

**Layout Paradigm**: 행과 열이 반복되는 워크북 구조이며, 분석 결과는 캘린더와 백과사전의 셀처럼 쌓인다.

**Signature Elements**: 굵은 2px 테두리, 스티커형 경고 라벨, 손글씨 느낌의 메모 박스가 반복된다.

**Interaction Philosophy**: 입력하면 셀이 채워지고, 저장하면 워크북에 누적되는 감각을 준다.

**Animation**: 거의 애니메이션을 쓰지 않고, 선택된 셀만 120ms 색상 전환을 준다.

**Typography System**: 제목은 Archivo Black 또는 굵은 Pretendard, 본문은 Noto Sans KR, 숫자는 JetBrains Mono 계열을 사용한다.
</idea>
</text>
<probability>0.05</probability>
</response>

<response>
<text>
<idea>
**Design Movement**: Editorial Financial Magazine.

**Core Principles**: 금융 리포트와 잡지형 에디토리얼을 결합한다. 큰 제목, 세로 구획선, 캡션, 긴 리포트 문장을 활용한다. 앱이라기보다 ‘오늘의 종목 분석지’를 읽는 경험을 제공한다.

**Color Philosophy**: 크림색 종이, 먹색, 와인색 강조, 은은한 금색 선을 사용해 장기 투자 리포트의 품격을 표현한다.

**Layout Paradigm**: 첫 화면은 신문 1면처럼 구성하고, 아래로 내려가며 기술적 분석, 수급·거래대금, 테마 기록, 리스크 노트가 기사처럼 이어진다.

**Signature Elements**: 섹션 넘버, 작은 캡션, 종이 질감의 미세한 배경 패턴이 반복된다.

**Interaction Philosophy**: 입력보다 읽기 경험을 중시하며, 결과는 PDF 리포트를 보는 듯 자연스럽게 펼쳐진다.

**Animation**: 스크롤 진입 시 문단 단위 fade-in을 사용하고 차트는 낮은 속도로 드로잉된다.

**Typography System**: 제목은 serif 계열, 본문은 Noto Sans KR, 숫자는 tabular-nums를 적용한 산세리프를 사용한다.
</idea>
</text>
<probability>0.08</probability>
</response>

## 선택한 디자인 철학

이번 앱에는 **Swiss International Typographic Style와 금융 터미널 미학의 결합**을 적용한다. 사용 목적이 투자 참고용 분석이므로, 장식보다 근거와 판단 구조가 분명해야 한다. 모든 화면은 “이 선택이 리서치 데스크의 신뢰감을 강화하는가, 아니면 흐리는가?”라는 질문을 기준으로 설계한다.
