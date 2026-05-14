# 개인 계정으로 직접 이전하는 방법

이 문서는 완성된 **주식 투자 전문가형 분석 데스크** 프로젝트를 개인 PC, 개인 GitHub, 개인 Firebase 계정으로 직접 옮기는 절차를 설명합니다. 브라우저 자동 로그인 오류가 발생했으므로, 계정 로그인과 배포는 사용자의 개인 브라우저에서 직접 진행하는 방식을 기준으로 합니다.

> 보안 안내: 이전 대화에 비밀번호가 노출되었으므로, 해당 Google 계정과 GitHub 계정의 비밀번호를 새 값으로 변경하고 2단계 인증을 켜는 것을 권장합니다. 이후에는 비밀번호를 채팅창에 입력하지 마세요.

## 1. 프로젝트 파일 확보

가장 쉬운 방식은 Manus 화면의 체크포인트 또는 코드 다운로드 기능을 사용하는 것입니다. 최신 체크포인트는 `8cb06d8e`이며, Firebase Authentication과 PDF 저장 기능이 반영된 버전입니다.

| 항목 | 값 |
|---|---|
| 프로젝트 이름 | `stock-expert-analyzer` |
| 최신 체크포인트 | `8cb06d8e` |
| 주요 기능 | Firebase 이메일/비밀번호 로그인, 주식 분석 리포트, PDF 저장 |
| 배포 대상 | Firebase Hosting |

Manus 화면에서 프로젝트의 **Code** 또는 **Download as ZIP** 기능으로 전체 소스 파일을 내려받으세요. 압축을 풀면 `package.json`, `firebase.json`, `.env.example`, `firebase.env.template`, `README.md`, `HANDOFF.md`가 보여야 합니다.

## 2. 개인 PC에서 실행 준비

개인 PC에 Node.js와 pnpm이 필요합니다. Node.js는 LTS 버전을 설치하면 되고, 터미널에서 아래 명령어로 pnpm을 설치할 수 있습니다.

```bash
npm install -g pnpm
```

압축을 푼 프로젝트 폴더로 이동한 뒤 의존성을 설치합니다.

```bash
cd stock-expert-analyzer
pnpm install
```

## 3. GitHub 저장소 만들기

개인 브라우저에서 [GitHub](https://github.com)에 로그인한 뒤 새 저장소를 만듭니다. 저장소 이름은 예를 들어 `stock-expert-analyzer`로 두면 됩니다. 저장소 생성 시 README, .gitignore, license는 체크하지 않는 편이 좋습니다. 이미 프로젝트 안에 필요한 파일이 들어 있기 때문입니다.

저장소를 만든 뒤, 프로젝트 폴더에서 아래 명령어를 실행합니다. `YOUR_GITHUB_ID`는 본인의 GitHub 아이디로 바꾸세요.

```bash
git init
git add .
git commit -m "Initial stock expert analyzer app"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_ID/stock-expert-analyzer.git
git push -u origin main
```

만약 `remote origin already exists` 오류가 나오면 아래처럼 기존 연결을 지우고 다시 연결합니다.

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_GITHUB_ID/stock-expert-analyzer.git
git push -u origin main
```

## 4. Firebase 프로젝트 만들기

개인 브라우저에서 [Firebase Console](https://console.firebase.google.com)에 로그인하고 새 프로젝트를 만듭니다. 프로젝트 이름은 `stock-expert-analyzer`처럼 알아보기 쉽게 지정하면 됩니다.

프로젝트가 만들어지면 **Authentication** 메뉴로 이동해 시작하기를 누르고, 로그인 제공업체에서 **Email/Password**를 활성화합니다. 그 다음 **Users** 탭에서 앱을 사용할 사람의 이메일 계정을 직접 추가합니다.

## 5. Firebase 웹앱 설정값 복사

Firebase Console의 프로젝트 설정에서 웹앱을 추가합니다. 웹앱 닉네임은 `stock-expert-analyzer-web`처럼 입력하면 됩니다. 등록 후 Firebase SDK 설정값이 보이면, 그 값을 프로젝트의 `.env` 파일에 입력합니다.

먼저 프로젝트 루트에서 `.env.example`을 복사해 `.env`를 만듭니다.

```bash
cp .env.example .env
```

그 다음 `.env` 파일을 열어 아래 형식으로 값을 채웁니다.

```bash
VITE_FIREBASE_API_KEY=본인_apiKey
VITE_FIREBASE_AUTH_DOMAIN=본인_authDomain
VITE_FIREBASE_PROJECT_ID=본인_projectId
VITE_FIREBASE_STORAGE_BUCKET=본인_storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=본인_messagingSenderId
VITE_FIREBASE_APP_ID=본인_appId
```

값을 입력한 뒤 로컬 실행으로 확인합니다.

```bash
pnpm run dev
```

브라우저에서 표시된 로컬 주소로 들어가 Firebase에 등록한 이메일과 비밀번호로 로그인해 보세요.

## 6. Firebase Hosting 배포

처음 한 번만 Firebase CLI를 설치합니다.

```bash
npm install -g firebase-tools
```

개인 브라우저 로그인이 가능한 상태에서 아래 명령어를 실행합니다.

```bash
firebase login
```

프로젝트 연결은 다음 명령어로 진행합니다.

```bash
firebase use --add
```

목록에서 방금 만든 Firebase 프로젝트를 선택하고 alias는 `default`로 입력합니다. 빌드 후 배포합니다.

```bash
pnpm run build
firebase deploy
```

배포가 완료되면 터미널에 Hosting URL이 표시됩니다. 그 주소가 다른 사람이 접속할 수 있는 앱 주소입니다. 단, Firebase Authentication에 등록한 이메일 계정만 로그인할 수 있습니다.

## 7. 자주 발생하는 문제

| 문제 | 원인 | 해결 방법 |
|---|---|---|
| 로그인 화면에 Firebase 설정 누락 표시 | `.env` 값이 비어 있음 | Firebase 웹앱 설정값을 `.env`에 입력하고 다시 실행합니다. |
| 로그인 실패 | Firebase Authentication에 사용자가 등록되지 않음 | Firebase Console의 Authentication > Users에서 이메일 사용자를 추가합니다. |
| `firebase` 명령어가 없음 | Firebase CLI 미설치 | `npm install -g firebase-tools`를 실행합니다. |
| 배포 후 흰 화면 | 빌드 실패 또는 환경변수 누락 | `pnpm run build`를 먼저 확인하고 `.env` 값을 다시 점검합니다. |
| PDF 저장이 안 됨 | 브라우저 팝업 또는 다운로드 제한 | 브라우저 다운로드 권한을 허용하고 다시 시도합니다. |

## 8. 이전 후 수정 방법

개인 계정으로 이전이 끝나면, 향후 수정은 개인 Manus 계정에서 GitHub 저장소를 불러오거나 압축 파일을 업로드해 진행하면 됩니다. Firebase 설정값은 개인 정보이므로 GitHub에 올리지 말고 `.env`에만 보관하세요. `.gitignore`에 `.env`가 포함되어 있으므로 일반적인 `git add .` 명령으로는 업로드되지 않습니다.

## 9. 추천 다음 개선

사용자별 분석 기록을 저장하고 싶다면 Firestore를 추가하면 됩니다. 여러 사람이 각자 리포트를 관리하려면 사용자 UID 기준으로 저장 구조를 만들면 됩니다. 또한 관리자만 사용자 목록을 관리하도록 Firebase Custom Claims 또는 별도의 관리자 화면을 붙일 수 있습니다.
