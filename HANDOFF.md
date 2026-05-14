# 개인별 인수인계 가이드

이 문서는 현재 작업 공간에서 만든 결과물을 개인 Manus, 개인 GitHub, 개인 Firebase 계정으로 옮겨 계속 수정하기 위한 안내서입니다. 핵심 원칙은 **앱 소스는 공유하되, 계정·Firebase 프로젝트·사용자 계정은 각자가 따로 관리한다**는 것입니다.

## 인수인계 개요

| 항목 | 현재 상태 | 개인 계정에서 해야 할 일 |
|---|---|---|
| 앱 코드 | `/home/ubuntu/stock-expert-analyzer`에 구현 | ZIP으로 내려받거나 GitHub로 옮겨 개인 Manus에서 다시 열기 |
| 로그인 | Firebase Authentication 이메일/비밀번호 방식 | 개인 Firebase 프로젝트에서 Email/Password 활성화 후 허용 사용자 등록 |
| 환경 설정 | `firebase.env.template`, `config.template` 제공 | 템플릿을 참고해 개인 `.env` 파일 작성 |
| Firebase 배포 | `firebase.json`, `.firebaserc.example` 제공 | 개인 Firebase 프로젝트 ID로 `.firebaserc` 작성 후 배포 |
| PDF 저장 | 리포트 화면 PDF 저장 버튼 구현 | 브라우저 다운로드 권한만 확인하면 사용 가능 |
| GitHub 원격 주소 | 특정 계정에 고정하지 않음 | 개인 GitHub 저장소를 만든 뒤 remote 연결 |

## 개인 Manus에서 이어서 수정하는 흐름

먼저 현재 프로젝트를 ZIP으로 다운로드하거나 GitHub 저장소로 옮깁니다. 이후 개인 Manus 계정에서 새 작업을 시작할 때 이 프로젝트 폴더를 기준으로 수정 요청을 하면 됩니다. 앱 구조가 정적 React/Vite 프로젝트라서, 개인 계정에서도 화면, 분석 로직, Firebase 연동, PDF 출력 기능을 계속 고칠 수 있습니다.

## Firebase 로그인 설정 흐름

Firebase Console에서 프로젝트를 만든 뒤 **Authentication > Sign-in method**에서 **Email/Password**를 활성화합니다. 이후 **Authentication > Users**에서 앱을 보여줄 사람의 이메일과 임시 비밀번호를 직접 등록합니다. 각 사용자는 등록된 이메일과 비밀번호로만 로그인할 수 있습니다.

프로젝트 루트에는 실제 `.env` 파일을 직접 만들고 `firebase.env.template`에 적힌 `VITE_FIREBASE_*` 값을 채워야 합니다. `.env`는 개인 설정 파일이므로 GitHub에 올리지 않는 것을 권장합니다.

## 배포 전 점검표

| 점검 항목 | 권장 상태 |
|---|---|
| Firebase Auth 활성화 | Email/Password 제공자 활성화 |
| 사용자 등록 | 접근 허용 대상 이메일 계정만 Firebase Users에 등록 |
| 환경변수 입력 | `.env`에 개인 Firebase 웹앱 설정값 입력 |
| 투자 고지 문구 유지 | 앱이 투자 조언이 아닌 참고 도구임을 표시 |
| 공개 저장소 민감정보 점검 | `.env`, `.firebaserc`, API 키가 커밋되지 않도록 확인 |
| 빌드 검사 | `pnpm run check`와 `pnpm run build` 통과 |
| 배포 도메인 확인 | Firebase Authentication Authorized domains에 배포 도메인 포함 |
| PDF 저장 확인 | 샘플 데이터 분석 후 PDF 다운로드가 되는지 확인 |

## 향후 보완 요청 예시

개인 Manus에서 이어서 수정할 때는 아래처럼 요청하면 됩니다.

> 이 프로젝트에 코스피/코스닥 종목용 입력값을 추가하고, 거래대금 조건을 한국 시장 기준으로 더 세분화해 주세요.

> Firebase Authentication에 회원가입 화면은 빼고, 관리자만 사용자를 추가할 수 있게 유지해 주세요.

> Firestore에 사용자별 분석 리포트 히스토리를 저장하도록 바꿔 주세요.

> 특정 API를 연결해 실시간 주가를 불러오도록 바꿔 주세요. 단, API 키가 노출되지 않게 백엔드 구조로 바꿔 주세요.

## 보안상 주의할 점

현재 버전은 Firebase Authentication으로 로그인 사용자를 구분하지만, 정적 프론트엔드 앱이라는 한계는 있습니다. 실제 투자 데이터 저장, 사용자별 권한, 유료 API 키 보호가 필요하면 Firestore 보안 규칙, 별도 백엔드, 또는 서버 측 권한 검증을 추가하는 것이 좋습니다. 특히 실시간 시세 API 키나 유료 데이터 API 키는 프론트엔드 코드에 직접 넣지 않는 것을 권장합니다.
