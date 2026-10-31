# Chancery of Ink — Russian Lives: Act III

브라우저에서 바로 실행되는 정적 RPG입니다. Vercel 빌드는 `npm run build:v33`으로 `dist-v33/`를 만들고, 이 디렉터리만 배포합니다. 게임은 선택형 AI 대화 Worker 없이도 플레이할 수 있습니다.

## Vercel 배포

1. Vercel에서 **Add New → Project**를 선택하고 `coshaman/historydigital` 저장소를 가져옵니다.
2. Root Directory는 저장소 루트로 둡니다. 저장소의 [`vercel.json`](./vercel.json)이 Framework Preset을 **Other**, 설치 명령을 `npm ci`, 빌드 명령을 `npm run build:v33`, Output Directory를 `dist-v33`로 지정합니다.
3. Production Branch를 `master`로 선택하고 배포합니다. Git 연동 후 `master`에 push하면 Production 배포가 생성되고, 다른 브랜치는 Preview 배포가 됩니다.

**일반 게임 배포에는 환경변수가 필요 없습니다.** Vercel은 정적 게임 파일을 제공하며 `npm start`나 `server.mjs`를 운영 서버로 실행하지 않습니다. 선택형 AI 대화는 기존 Cloudflare Worker에서 처리합니다. Vercel에 API 키만 입력해도 AI 서버가 생기는 구조는 아닙니다.

### 선택 사항: AI 대화 Worker 주소

AI 대화를 켜려면 먼저 [`ai/v33/worker/README.md`](./ai/v33/worker/README.md)의 안내대로 Cloudflare Worker를 배포합니다. Vercel 프로젝트의 **Settings → Environment Variables → Add Environment Variable**에서 다음 변수를 추가합니다.

| 항목 | 값 |
| --- | --- |
| Name | `RPG_AI_API_BASE_URL` |
| Value | Worker origin, 예: `https://russian-lives-v33-rpg-ai.example.workers.dev` |
| Type | Config (공개 설정) |
| Environment | Production. Preview에서도 시험하려면 해당 Preview의 origin을 Worker 허용 목록에 먼저 추가한 뒤 Preview도 선택 |

값은 `https://`로 시작하는 origin만 입력합니다. 경로, 끝점 경로(`/api/...`), query, fragment는 넣지 않습니다. 저장한 뒤 Production 배포를 다시 실행해야 새 빌드에 적용됩니다.

이 주소는 정적 빌드 시 `window.V33_RPG_AI_API_BASE_URL`로 게임 파일에 포함되어 방문자에게 공개됩니다. **공개 Worker 주소일 뿐이므로 비밀 값이 아닙니다.** `OPENAI_API_KEY`나 `RPG_SESSION_SIGNING_KEY`를 이 변수 또는 Vercel 환경 변수에 넣지 마세요. 두 키는 Cloudflare Worker의 secret으로만 등록합니다.

Worker 쪽 `RPG_ALLOWED_ORIGINS`에는 실제 게임의 브라우저 origin을 별도로 지정해야 합니다. Vercel 기본 도메인을 쓰면 `https://<프로젝트>.vercel.app`, 사용자 도메인을 쓰면 `https://<사용자-도메인>`을 넣습니다. 주소 뒤에 경로를 붙이지 않습니다. Preview 도메인은 Production origin과 다르므로 Preview에서 AI를 사용할 때만 그 Preview origin도 허용 목록에 추가하세요.

`RPG_AI_API_BASE_URL`을 설정하지 않으면 게임은 내장 대화로 계속 진행됩니다. 값을 추가하거나 변경한 뒤에는 새 배포를 해야 합니다.

### 환경변수를 넣는 위치

| 변수 | 등록 위치 | 용도 |
| --- | --- | --- |
| `RPG_AI_API_BASE_URL` | Vercel → Settings → Environment Variables | 공개 Worker 주소. `VITE_`나 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. |
| `RPG_ALLOWED_ORIGINS` | Worker의 `wrangler.toml` → `[vars]` | 접속을 허용할 게임 origin. 여러 주소는 쉼표로 구분합니다. |
| `OPENAI_DIALOGUE_MODEL` | Worker의 `wrangler.toml` → `[vars]` | 해당 API 프로젝트에서 사용 가능한 대화 모델 이름 |
| `OPENAI_API_KEY` | Worker secret | `npx wrangler secret put OPENAI_API_KEY`로 등록 |
| `RPG_SESSION_SIGNING_KEY` | Worker secret | `npx wrangler secret put RPG_SESSION_SIGNING_KEY`로 등록 |

예를 들어 게임 주소가 `https://historydigital.vercel.app`이면 Worker 설정은 다음과 같습니다. 실제 배포 주소로 바꾸고 Worker를 재배포하세요.

```toml
RPG_ALLOWED_ORIGINS = "https://historydigital.vercel.app,https://coshaman.github.io"
```

환경변수 변경은 기존 배포에 소급 적용되지 않습니다. Vercel의 **Deployments → 해당 배포 → Redeploy**로 다시 빌드하세요. [Vercel 환경변수 문서](https://vercel.com/docs/environment-variables)

### 배포 후 확인 / 문제 해결

- 게임 주소의 `/rpg/ai/config.js`를 열면 이번 빌드에 포함된 Worker 주소를 확인할 수 있습니다. 빈 문자열이면 내장 대화 모드입니다.
- 화면이 이전 버전이면 Production 배포의 브랜치와 커밋을 확인하세요. GitHub Pages와 Vercel은 서로 다른 배포입니다.
- AI만 동작하지 않으면 Worker 주소, 실제 게임 origin의 허용 여부, Worker secret 등록 상태를 확인하세요. Preview 주소도 별도의 origin입니다.
- `RPG_AI_API_BASE_URL` 오류로 빌드가 실패하면 주소에서 `/api/...`, query, 로그인 정보 등을 제거하고 HTTPS origin만 입력하세요.
- 저장 기록은 브라우저의 사이트별 저장소에 남습니다. GitHub Pages에서 Vercel로 주소를 옮겨도 기존 저장 기록이 자동 이전되지는 않습니다.

## 로컬 실행

```sh
npm ci
npm run start
```

브라우저에서 터미널이 표시한 로컬 주소를 엽니다. Worker 없이 실행하면 내장 대화를 사용합니다.

Vercel과 같은 빌드 결과로 AI 설정을 시험하려면 PowerShell에서 다음을 실행합니다. 예시 주소를 실제 Worker 주소로 바꾸고, Worker 허용 목록에는 `http://127.0.0.1:4173`을 추가하세요.

```powershell
$env:RPG_AI_API_BASE_URL = 'https://your-worker.workers.dev'
npm run build:v33
npm start
```

이때 **`http://127.0.0.1:4173/dist-v33/index.html`**을 엽니다. 루트 주소는 빌드 전 소스를 제공합니다. 빌드 스크립트는 `.env` 파일을 자동으로 읽지 않으므로 로컬에서는 위처럼 프로세스 환경변수를 설정하세요. Vercel에서는 대시보드에 등록한 변수가 빌드에 전달됩니다.

## Vercel이 아닌 수동 정적 빌드

```sh
npm ci
npm run build:v33
```

생성된 `dist-v33/` 디렉터리를 정적 호스팅에 올립니다. 하위 경로 배포도 상대 경로로 동작합니다.

## 관련 문서

- [Vercel 배포 설정](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel 환경 변수](https://vercel.com/docs/environment-variables)
- [Worker 설치 및 보안 설정](./ai/v33/worker/README.md)
- [배포 구조와 검증 기록](./docs/v33/DEPLOYMENT.md)
