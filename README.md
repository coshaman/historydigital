# Chancery of Ink — Russian Lives: Act III

브라우저에서 바로 실행되는 정적 RPG입니다. Vercel 빌드는 `npm run build:v33`으로 `dist-v33/`를 만들고, 이 디렉터리만 배포합니다. 게임은 선택형 AI 대화 Worker 없이도 플레이할 수 있습니다.

## Vercel 배포

1. Vercel에서 **Add New → Project**를 선택하고 `coshaman/historydigital` 저장소를 가져옵니다.
2. Root Directory는 저장소 루트로 둡니다. 저장소의 [`vercel.json`](./vercel.json)이 Framework Preset을 **Other**, 설치 명령을 `npm ci`, 빌드 명령을 `npm run build:v33`, Output Directory를 `dist-v33`로 지정합니다.
3. Production Branch를 `master`로 선택하고 배포합니다. Git 연동 후 `master`에 push하면 Production 배포가 생성되고, 다른 브랜치는 Preview 배포가 됩니다.

### 선택 사항: AI 대화 Worker 주소

AI 대화를 켜려면 먼저 [`ai/v33/worker/README.md`](./ai/v33/worker/README.md)의 안내대로 Cloudflare Worker를 배포합니다. Vercel 프로젝트의 **Settings → Environment Variables → Add Environment Variable**에서 다음 변수를 추가합니다.

| 항목 | 값 |
| --- | --- |
| Name | `RPG_AI_API_BASE_URL` |
| Value | Worker origin, 예: `https://russian-lives-v33-rpg-ai.example.workers.dev` |
| Environment | Production. Preview에서도 시험하려면 해당 Preview의 origin을 Worker 허용 목록에 먼저 추가한 뒤 Preview도 선택 |

값은 `https://`로 시작하는 origin만 입력합니다. 경로, 끝점 경로(`/api/...`), query, fragment는 넣지 않습니다. 저장한 뒤 Production 배포를 다시 실행해야 새 빌드에 적용됩니다.

이 주소는 정적 빌드 시 `window.V33_RPG_AI_API_BASE_URL`로 게임 파일에 포함되어 방문자에게 공개됩니다. **공개 Worker 주소일 뿐이므로 비밀 값이 아닙니다.** `OPENAI_API_KEY`나 `RPG_SESSION_SIGNING_KEY`를 이 변수 또는 Vercel 환경 변수에 넣지 마세요. 두 키는 Cloudflare Worker의 secret으로만 등록합니다.

Worker 쪽 `RPG_ALLOWED_ORIGINS`에는 실제 게임의 브라우저 origin을 별도로 지정해야 합니다. Vercel 기본 도메인을 쓰면 `https://<프로젝트>.vercel.app`, 사용자 도메인을 쓰면 `https://<사용자-도메인>`을 넣습니다. 주소 뒤에 경로를 붙이지 않습니다. Preview 도메인은 Production origin과 다르므로 Preview에서 AI를 사용할 때만 그 Preview origin도 허용 목록에 추가하세요.

`RPG_AI_API_BASE_URL`을 설정하지 않으면 게임은 내장 대화로 계속 진행됩니다. 값을 추가하거나 변경한 뒤에는 새 배포를 해야 합니다.

## 로컬 실행

```sh
npm ci
npm run start
```

브라우저에서 터미널이 표시한 로컬 주소를 엽니다. Worker 없이 실행하면 오프라인 대화를 사용합니다. 로컬 AI 대화를 시험할 때는 빌드 전에 `RPG_AI_API_BASE_URL`을 설정하고 Worker의 `RPG_ALLOWED_ORIGINS`에 로컬 origin을 추가하세요.

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
