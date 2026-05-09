# Convex Self-Hosting Plan

작성일: 2026-05-08
최종 확인: 2026-05-09

## 목표

- Mac mini에서 Convex self-hosted backend를 운영한다.
- Cloudflare Tunnel로 Convex API를 외부 HTTPS 도메인에 연결한다.
- frontend는 현재 Vercel 배포를 유지하고, self-hosted Convex URL만 연결한다.
- dashboard는 기본적으로 Tailscale 개인 접근만 허용한다.
- 기존 Convex Cloud deployment의 데이터를 snapshot ZIP으로 가져와 self-hosted deployment에 복원한다.
- 모든 명령은 이 repo 규칙에 맞춰 `pnpm`을 사용한다.

## 확인된 현재 상태

- 작업은 Mac mini 내부에서 직접 실행하는 기준이다.
- Mac mini 상태: `siltwise`, Apple Silicon `arm64`, macOS 26.3.
- Mac mini에는 Docker Desktop/Compose가 동작 중이다. 확인된 버전은 Docker 29.4.0, Docker Compose 5.1.2다.
- Mac mini의 Cloudflare Tunnel은 launchd service로 실행 중이다.
- 실제 tunnel config: `/Users/echoja/.cloudflared/config.yml`.
- 현재 tunnel ingress에는 `happy.echoja.com`, `pds.echoja.com`, `*.pds.echoja.com`만 있다.
- Cloudflare DNS는 `echoja.com`에서 관리 중이다.
- frontend는 Vercel 유지. Mac mini static hosting은 이번 migration 범위에서 제외한다.
- backup은 하루 1회 local snapshot ZIP으로 시작한다.
- downtime 제한은 없다. 사용자는 본인 1명 기준이다.

## 확인된 Convex Cloud 상태

- Convex team: `englishpunch-app`.
- Convex project: `englishpunch`.
- 현재 repo `.env` source: `CONVEX_DEPLOYMENT=dev:strong-otter-914`.
- dev deployment: `strong-otter-914`, region `aws-us-east-1`.
- prod deployment: `quiet-cheetah-461`, region `aws-us-east-1`.
- 현재 Convex Management API 기준으로 이 project에는 preview deployment가 보이지 않는다. 사용자가 말한 “preview”는 현재 repo 설정 기준으로는 dev deployment일 가능성이 높다.
- 2026-05-09 재확인 결과, `https://strong-otter-914.convex.cloud/version`과 `https://strong-otter-914.convex.site/health`는 200을 반환한다.
- `pnpm exec convex data`, `pnpm exec convex env list`, `pnpm exec convex export`, `pnpm exec convex dev --once` 모두 dev deployment에서 정상 동작한다.
- prod deployment `quiet-cheetah-461`은 live지만 DB table이 없고 env vars도 없다.
- 따라서 데이터 source는 dev `strong-otter-914`로 둔다.

## 전제

- Mac mini는 전원 연결, sleep 방지, Docker/Cloudflare Tunnel 자동 재시작이 설정되어 있다.
- 초기 운영은 개인용/저트래픽 기준으로 SQLite 기반 Docker volume을 사용한다.
- 기존 Cloud source는 dev `strong-otter-914`로 둔다.
- 이 앱은 Convex Auth Password provider를 사용한다. 데이터 snapshot에는 `users`, `authAccounts`, `authSessions` 등 auth table 문서가 포함된다.
- 현재 코드에서는 Convex file storage 사용이 보이지 않지만, migration export는 안전하게 `--include-file-storage`를 붙인다.
- self-hosted import 대상은 새 deployment이므로 기존 데이터가 있으면 전부 덮어쓴다.

## 도메인 설계

- `ep-convex.echoja.com`: Convex backend/API, Mac mini `localhost:3210`
- `ep-convex-site.echoja.com`: Convex HTTP actions/Auth routes, Mac mini `localhost:3211`
- dashboard: Tailscale에서 `http://<mac-mini-tailscale-name>:6791`로 접근
- `ep.echoja.com`: 나중에 frontend까지 Mac mini로 옮길 때만 사용

dashboard를 공개 hostname으로 열어야 하면 Cloudflare Access를 먼저 붙인다.

## 작업 디렉터리

snapshot ZIP에는 개인 데이터와 auth 데이터가 들어간다. repo 안이 아니라 사용자 홈 아래에 둔다.

```sh
mkdir -p ~/services/english-punch-convex
mkdir -p ~/Backups/english-punch/convex
```

secret env 파일은 `.env*` 패턴으로 git ignore 되어 있지만, 가능하면 repo 밖 또는 로컬 전용 파일로만 둔다.

## 1. Self-Hosted Convex 기동

Mac mini에서 실행한다.

```sh
cd ~/services/english-punch-convex
curl -O https://raw.githubusercontent.com/get-convex/convex-backend/main/self-hosted/docker/docker-compose.yml
```

`~/services/english-punch-convex/.env`:

```sh
INSTANCE_NAME=english-punch
INSTANCE_SECRET=<openssl rand -hex 32>

CONVEX_CLOUD_ORIGIN=https://ep-convex.echoja.com
CONVEX_SITE_ORIGIN=https://ep-convex-site.echoja.com
NEXT_PUBLIC_DEPLOYMENT_URL=https://ep-convex.echoja.com

REDACT_LOGS_TO_CLIENT=true
DISABLE_BEACON=true
```

기동:

```sh
docker compose up -d
docker compose ps
curl http://127.0.0.1:3210/version
```

admin key 생성:

```sh
docker compose exec backend ./generate_admin_key.sh
```

나중에 안정화되면 `ghcr.io/get-convex/convex-backend:latest`와 `ghcr.io/get-convex/convex-dashboard:latest`를 release tag로 pinning한다.

## 2. Cloudflare Tunnel 연결

Mac mini의 현재 tunnel config는 `/Users/echoja/.cloudflared/config.yml`이다.

```sh
sed -n "1,220p" ~/.cloudflared/config.yml
```

현재 ingress에 아래 두 항목을 추가한다. 기존 `happy.echoja.com`, `pds.echoja.com`, `*.pds.echoja.com` 항목은 유지한다.

```yaml
ingress:
  - hostname: happy.echoja.com
    service: http://localhost:37291
  - hostname: pds.echoja.com
    service: http://localhost:3000
  - hostname: "*.pds.echoja.com"
    service: http://localhost:3000
  - hostname: ep-convex.echoja.com
    service: http://localhost:3210
  - hostname: ep-convex-site.echoja.com
    service: http://localhost:3211
  - service: http_status:404
```

Cloudflare DNS route 추가:

```sh
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep-convex.echoja.com
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep-convex-site.echoja.com
```

Cloudflare Tunnel 재시작:

```sh
brew services restart cloudflared
```

검증:

```sh
curl https://ep-convex.echoja.com/version
curl https://ep-convex-site.echoja.com/health
```

## 3. Repo에서 Self-Hosted Deployment 연결

repo 루트에서 로컬 전용 env 파일을 만든다.

`.env.convex-selfhost`:

```sh
CONVEX_SELF_HOSTED_URL=https://ep-convex.echoja.com
CONVEX_SELF_HOSTED_ADMIN_KEY=<generated admin key>
```

먼저 함수/스키마를 self-hosted backend에 배포한다.

```sh
pnpm exec convex deploy --env-file .env.convex-selfhost -y
```

프론트엔드용 `.env.local` 전환값:

```sh
VITE_CONVEX_URL=https://ep-convex.echoja.com
```

현재 app code는 `VITE_CONVEX_URL`만 읽는다. `VITE_CONVEX_SITE_URL`은 로컬 env에 있지만 코드 사용처가 없다.

## 4. Convex Env Vars 복사

Convex backup/export는 code, deployment config, env vars, pending scheduled functions를 포함하지 않는다. 데이터 복원 전에 env vars를 별도로 복사한다.

2026-05-09 기준 dev source의 `pnpm exec convex env list`는 정상 동작한다. 확인된 env var 이름은 다음이다.

- `CONVEX_OPENAI_API_KEY`
- `CONVEX_OPENAI_BASE_URL`
- `GEMINI_API_KEY`: Convex action `convex/ai.ts`가 필요로 한다.
- `SITE_URL`: Convex Auth redirect allowlist. 현재 frontend를 유지하므로 `https://englishpunch.vercel.app`로 둔다.
- `CONVEX_SITE_URL`: Convex Auth issuer/domain에서 사용된다. 직접 `convex env set`으로 넣는 값이 아니라 self-hosted backend의 `CONVEX_SITE_ORIGIN=https://ep-convex-site.echoja.com`에서 제공되어야 한다.
- `JWT_PRIVATE_KEY`, `JWKS`: Convex Auth manual setup key. 기존 session 유지가 중요하면 Cloud 값을 가져오고, 아니면 새로 생성 후 재로그인을 허용한다.

다음 값은 Convex runtime migration 대상이 아니다.

- `VITE_CONVEX_URL`: frontend build/runtime env. Vercel에서 설정한다.
- `VITE_CONVEX_SITE_URL`: 현재 코드 사용처가 없다.
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`: local/e2e 전용이다.
- `CONVEX_USER_EMAIL`, `CONVEX_USER_PASSWORD`: MCP 서버를 password provider로 로그인시키는 운영 env다. self-hosted cutover 후에도 같은 계정을 쓸 수 있다.
- `EP_CONVEX_URL`, `CONVEX_URL`: CLI/MCP가 어느 Convex backend를 볼지 고르는 client env다.

cloud 쪽 목록 확인:

```sh
pnpm exec convex env list
```

source를 env file로 명시할 때:

```sh
pnpm exec convex env --env-file .env.convex-cloud-export list
```

self-hosted에 필요한 값:

```sh
pnpm exec convex env --env-file .env.convex-selfhost set SITE_URL https://englishpunch.vercel.app
pnpm exec convex env --env-file .env.convex-selfhost set CONVEX_OPENAI_API_KEY "$CONVEX_OPENAI_API_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set CONVEX_OPENAI_BASE_URL "$CONVEX_OPENAI_BASE_URL"
pnpm exec convex env --env-file .env.convex-selfhost set GEMINI_API_KEY "$GEMINI_API_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set JWT_PRIVATE_KEY "$JWT_PRIVATE_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set JWKS "$JWKS"
pnpm exec convex env --env-file .env.convex-selfhost list
```

`JWT_PRIVATE_KEY`와 `JWKS`는 기존 Cloud deployment 값을 그대로 가져오는 편이 가장 안전하다. 값을 새로 만들면 기존 password login 데이터는 남아도 기존 auth session/token은 무효화될 수 있다. 기존 값을 못 가져오면 Convex Auth manual setup 방식으로 새 key pair를 만들고, 사용자는 재로그인한다고 가정한다.

## 5. 기존 Convex Cloud 데이터 Export

실수로 다른 deployment를 export/import하지 않도록 source와 target env file을 분리한다.

`.env.convex-cloud-export` 예시:

```sh
CONVEX_DEPLOYMENT=dev:strong-otter-914
```

현재 prod `quiet-cheetah-461`은 live지만 DB/env가 비어 있으므로 migration source로 쓰지 않는다.

source 상태 확인:

```sh
curl https://strong-otter-914.convex.cloud/version
pnpm exec convex export --env-file .env.convex-cloud-export --path /tmp/probe.zip
```

위 명령이 200/export success를 반환하면 export를 진행한다.

rehearsal export:

```sh
BACKUP_DIR=~/Backups/english-punch/convex
TODAY=$(date +%Y-%m-%d)
SNAPSHOT="$BACKUP_DIR/cloud-rehearsal-$TODAY.zip"

pnpm exec convex export \
  --env-file .env.convex-cloud-export \
  --include-file-storage \
  --path "$SNAPSHOT"

zipinfo -1 "$SNAPSHOT" | head
```

cutover 직전에는 짧은 write freeze를 잡는다. 개인용이면 기존 앱 사용을 멈추고 마지막 snapshot을 다시 뜬다.

```sh
TODAY=$(date +%Y-%m-%d)
FINAL_SNAPSHOT="$BACKUP_DIR/cloud-final-$TODAY.zip"

pnpm exec convex export \
  --env-file .env.convex-cloud-export \
  --include-file-storage \
  --path "$FINAL_SNAPSHOT"
```

## 6. Self-Hosted로 Import

rehearsal import는 self-hosted target에만 실행한다.

```sh
pnpm exec convex import \
  --env-file .env.convex-selfhost \
  --replace-all \
  -y \
  "$SNAPSHOT"
```

final cutover 때는 final snapshot을 넣는다.

```sh
pnpm exec convex import \
  --env-file .env.convex-selfhost \
  --replace-all \
  -y \
  "$FINAL_SNAPSHOT"
```

`--replace-all`은 target deployment의 기존 데이터를 snapshot 기준으로 맞추는 파괴적 작업이다. 새 self-hosted deployment에만 사용한다. Cloud deployment에는 실행하지 않는다.

ZIP snapshot import는 `_id`와 `_creationTime`을 유지하므로 table 간 참조가 유지된다. 이 앱에서는 auth/user/card/review 데이터 관계를 유지하는 데 이 방식이 맞다.

## 7. 검증

CLI로 table 접근 확인:

```sh
pnpm exec convex data --env-file .env.convex-selfhost
pnpm exec convex data --env-file .env.convex-selfhost users --limit 5
pnpm exec convex data --env-file .env.convex-selfhost authAccounts --limit 5
```

브라우저 검증:

- `VITE_CONVEX_URL=https://ep-convex.echoja.com`로 frontend를 실행한다.
- 기존 계정 이메일/비밀번호로 로그인한다.
- bag/card 목록이 기존 Cloud 데이터와 맞는지 확인한다.
- card 생성/수정/삭제를 한 번씩 테스트한다.
- Gemini 기반 card draft 생성이 `GEMINI_API_KEY`로 동작하는지 확인한다.

health check:

```sh
curl https://ep-convex.echoja.com/version
curl https://ep-convex-site.echoja.com/health
```

CLI/MCP 전환:

```sh
export EP_CONVEX_URL=https://ep-convex.echoja.com
export CONVEX_URL=https://ep-convex.echoja.com
```

이 repo의 Go CLI 기본값은 cloud URL이므로, `EP_CONVEX_URL` 또는 CLI config를 self-hosted URL로 바꾼다. MCP 서버도 `CONVEX_URL`을 self-hosted URL로 지정한다.

## 8. Frontend 배포

frontend는 Vercel에 그대로 둔다. Vercel project env만 바꾼다.

```sh
VITE_CONVEX_URL=https://ep-convex.echoja.com
```

나중에 frontend까지 Mac mini로 옮길 때만 `ep.echoja.com`과 static server 구성을 별도 계획으로 다룬다.

## 9. Cutover 순서

1. self-hosted backend와 Cloudflare Tunnel health check 통과.
2. self-hosted에 함수/스키마 배포.
3. cloud env vars를 self-hosted env vars로 복사 또는 새로 생성.
4. rehearsal export/import/test 수행.
5. write freeze 시작.
6. final export.
7. final import with `--replace-all`.
8. Vercel `VITE_CONVEX_URL`을 self-hosted URL로 전환.
9. 기존 계정 로그인, 주요 workflow, CLI, MCP 확인.
10. Cloud deployment는 바로 삭제하지 말고 최소 며칠 read-only rollback 후보로 둔다.

## 10. Backup과 Rollback

운영 backup은 Convex export를 기준으로 잡는다.

```sh
BACKUP_DIR=~/Backups/english-punch/convex
TODAY=$(date +%Y-%m-%d)

pnpm exec convex export \
  --env-file .env.convex-selfhost \
  --include-file-storage \
  --path "$BACKUP_DIR/selfhost-$TODAY.zip"
```

snapshot 파일은 민감 데이터다. 외장 디스크, 암호화된 cloud storage, 또는 restic 같은 도구로 별도 백업한다.

rollback은 두 종류로 나눈다.

- cutover 직후 문제: frontend env를 기존 Convex Cloud URL로 되돌리고, Cloud deployment를 그대로 사용한다.
- self-hosted 데이터 문제: 마지막 정상 `selfhost-YYYY-MM-DD.zip`를 `pnpm exec convex import --env-file .env.convex-selfhost --replace-all -y <zip>`로 복원한다.

## 11. 나중에 강화할 것

- Docker image tag pinning과 upgrade runbook 작성.
- launchd로 Docker/Cloudflare Tunnel 자동 시작 확인.
- Mac mini 재부팅 후 `curl /version`, `curl /health` 자동 점검.
- file storage 사용량이 생기면 local volume 대신 S3/R2 storage 검토.
- frontend Mac mini hosting은 별도 후속 계획으로 분리.

## 참고

- Convex Self Hosting: https://docs.convex.dev/self-hosting
- Self-hosted Docker guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- Own infra routing guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md
- Convex Backup & Restore: https://docs.convex.dev/database/backup-restore
- Convex Data Import: https://docs.convex.dev/database/import-export/import
- Convex Auth manual setup: https://labs.convex.dev/auth/setup/manual
