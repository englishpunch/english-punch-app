# Convex Self-Hosting Plan

작성일: 2026-05-08
최종 수정: 2026-05-09

## 목표

- Mac mini에서 frontend와 Convex self-hosted backend를 모두 운영한다.
- Cloudflare Tunnel로 frontend와 Convex API/site origin을 외부 HTTPS 도메인에 연결한다.
- dashboard는 기본적으로 Tailscale 내부 접근만 허용한다.
- 기존 Convex Cloud dev deployment `strong-otter-914` 데이터를 snapshot ZIP으로 export해서 self-hosted deployment로 import한다.
- 모든 repo 명령은 `pnpm`으로 실행한다.

## 현재 기준

- 최신화한 repo Convex 패키지: `convex@1.38.0`, `@convex-dev/auth@0.0.92`, `@convex-dev/eslint-plugin@2.0.0`.
- source deployment: `dev:strong-otter-914`.
- 이 앱은 Convex Auth Password provider를 사용한다.
- 현재 코드상 필수 Convex runtime app secret은 `GEMINI_API_KEY`다.
- 현재 코드상 frontend는 `VITE_CONVEX_URL`만 읽는다.

## 도메인

- `ep.echoja.com`: frontend static app, Mac mini `localhost:4173`
- `ep-convex.echoja.com`: Convex backend/API, Mac mini `localhost:3210`
- `ep-convex-site.echoja.com`: Convex HTTP actions/Auth routes, Mac mini `localhost:3211`
- dashboard: Tailscale에서 `http://<mac-mini-tailscale-name>:6791`

## 로컬 파일

민감한 파일은 repo 안에 두더라도 git에 올리지 않는다. `.env.convex-*`는 ignore 대상이고, 예시는 tracked 파일로 둔다.

- `.env.convex-cloud-export`: Convex Cloud source 선택용
- `.env.convex-selfhost`: self-hosted Convex target 선택용
- frontend build env는 shell env 또는 로컬 `.env.local`에 둔다.
- Docker backend env는 repo 밖 `~/services/english-punch-convex/.env`에 둔다.

```sh
cp .env.convex-cloud-export.example .env.convex-cloud-export
cp .env.convex-selfhost.example .env.convex-selfhost
```

## Env 역할 분리

### Docker backend env

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

### Convex CLI target env

`.env.convex-cloud-export`:

```sh
CONVEX_DEPLOYMENT=dev:strong-otter-914
```

`.env.convex-selfhost`:

```sh
CONVEX_SELF_HOSTED_URL=https://ep-convex.echoja.com
CONVEX_SELF_HOSTED_ADMIN_KEY=<generated admin key>
```

### Convex runtime env

self-hosted deployment 안에 설정되는 server-side env다.

- `GEMINI_API_KEY`: `convex/ai.ts`에서 사용한다.
- `SITE_URL`: frontend origin. self-hosting 후 `https://ep.echoja.com`.
- `JWT_PRIVATE_KEY`, `JWKS`: Convex Auth manual setup key.

`CONVEX_SITE_URL`은 `convex/auth.config.ts`에서 issuer domain으로 사용된다. self-hosted backend의 `CONVEX_SITE_ORIGIN=https://ep-convex-site.echoja.com` 기준으로 제공되도록 둔다.

### Frontend build env

Mac mini에서 frontend를 build할 때만 필요하다.

```sh
VITE_CONVEX_URL=https://ep-convex.echoja.com
```

`VITE_CONVEX_SITE_URL`은 현재 코드 사용처가 없다.

### CLI/MCP client env

Go CLI:

```sh
export EP_CONVEX_URL=https://ep-convex.echoja.com
```

MCP server:

```sh
export CONVEX_URL=https://ep-convex.echoja.com
export CONVEX_USER_EMAIL=<email>
export CONVEX_USER_PASSWORD=<password>
```

## 1. Convex 기동

Mac mini에서 실행한다.

```sh
mkdir -p ~/services/english-punch-convex
cd ~/services/english-punch-convex
curl -O https://raw.githubusercontent.com/get-convex/convex-backend/main/self-hosted/docker/docker-compose.yml
```

`~/services/english-punch-convex/.env`를 작성한 뒤 기동한다.

```sh
docker compose up -d
docker compose ps
docker compose exec backend ./generate_admin_key.sh
```

생성한 admin key를 repo local file `.env.convex-selfhost`에 넣는다.

## 2. Cloudflare Tunnel

`/Users/echoja/.cloudflared/config.yml`의 ingress에 frontend와 Convex 항목을 추가한다.

```yaml
ingress:
  - hostname: happy.echoja.com
    service: http://localhost:37291
  - hostname: pds.echoja.com
    service: http://localhost:3000
  - hostname: "*.pds.echoja.com"
    service: http://localhost:3000
  - hostname: ep.echoja.com
    service: http://localhost:4173
  - hostname: ep-convex.echoja.com
    service: http://localhost:3210
  - hostname: ep-convex-site.echoja.com
    service: http://localhost:3211
  - service: http_status:404
```

DNS route:

```sh
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep.echoja.com
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep-convex.echoja.com
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep-convex-site.echoja.com
brew services restart cloudflared
```

health check:

```sh
curl https://ep-convex-site.echoja.com/health
```

## 3. Code Deploy와 Runtime Env

최신 Convex CLI 기준으로 self-hosted target은 `.env.convex-selfhost`로 선택한다.

```sh
pnpm install --frozen-lockfile
pnpm exec convex deploy --env-file .env.convex-selfhost
```

Cloud dev env 이름 확인:

```sh
pnpm exec convex env --env-file .env.convex-cloud-export list
```

self-hosted runtime env 설정:

```sh
pnpm exec convex env --env-file .env.convex-selfhost set SITE_URL https://ep.echoja.com
pnpm exec convex env --env-file .env.convex-selfhost set GEMINI_API_KEY "$GEMINI_API_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set JWT_PRIVATE_KEY "$JWT_PRIVATE_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set JWKS "$JWKS"
pnpm exec convex env --env-file .env.convex-selfhost list
```

## 4. Data Migration

snapshot은 repo 밖에 저장한다.

```sh
mkdir -p ~/Backups/english-punch/convex
BACKUP_DIR=~/Backups/english-punch/convex
TODAY=$(date +%Y-%m-%d)
SNAPSHOT="$BACKUP_DIR/cloud-final-$TODAY.zip"

pnpm exec convex export \
  --env-file .env.convex-cloud-export \
  --include-file-storage \
  --path "$SNAPSHOT"

zipinfo -1 "$SNAPSHOT" | head
```

self-hosted target으로 import한다.

```sh
pnpm exec convex import \
  --env-file .env.convex-selfhost \
  --replace-all \
  -y \
  "$SNAPSHOT"
```

`--replace-all`은 target deployment 전체 데이터를 snapshot 기준으로 맞춘다. Cloud source에는 실행하지 않는다.

## 5. Frontend Hosting

Mac mini에서 build한다.

```sh
VITE_CONVEX_URL=https://ep-convex.echoja.com pnpm build
```

첫 운영은 static server로 `dist/`를 `127.0.0.1:4173`에 올린다. Caddy를 쓰는 경우:

```sh
caddy file-server --listen 127.0.0.1:4173 --root dist
```

launchd service로 고정하기 전까지는 수동으로 frontend, Docker, cloudflared가 모두 살아 있는지 확인한다.

## 6. 검증

```sh
curl https://ep-convex-site.echoja.com/health
curl -I https://ep.echoja.com
pnpm exec convex data --env-file .env.convex-selfhost
pnpm exec convex data --env-file .env.convex-selfhost users --limit 5
pnpm exec convex data --env-file .env.convex-selfhost authAccounts --limit 5
```

브라우저에서 확인한다.

- `https://ep.echoja.com` 접속
- 기존 계정 이메일/비밀번호 로그인
- bag/card 목록 확인
- card 생성/수정/삭제 확인
- Gemini card draft 생성 확인
- Go CLI와 MCP server가 `https://ep-convex.echoja.com`을 보는지 확인

## 7. Cutover

1. Convex Docker 기동.
2. Cloudflare Tunnel에 `ep.echoja.com`, `ep-convex.echoja.com`, `ep-convex-site.echoja.com` 연결.
3. self-hosted Convex에 code deploy.
4. self-hosted Convex runtime env 설정.
5. Cloud dev에서 final snapshot export.
6. self-hosted Convex로 `--replace-all` import.
7. frontend를 `VITE_CONVEX_URL=https://ep-convex.echoja.com`로 build하고 static server에 배포.
8. `https://ep.echoja.com`에서 주요 workflow 확인.
9. CLI/MCP client env를 self-hosted URL로 전환.
10. Cloud deployment는 며칠 동안 rollback 후보로 보존한다.

## 8. Backup과 Rollback

운영 backup:

```sh
BACKUP_DIR=~/Backups/english-punch/convex
TODAY=$(date +%Y-%m-%d)

pnpm exec convex export \
  --env-file .env.convex-selfhost \
  --include-file-storage \
  --path "$BACKUP_DIR/selfhost-$TODAY.zip"
```

rollback:

- frontend 문제: `ep.echoja.com` static server를 이전 build로 되돌린다.
- Convex cutover 문제: frontend build를 기존 Cloud URL로 다시 만들고 Cloud deployment를 사용한다.
- self-hosted 데이터 문제: 마지막 정상 `selfhost-YYYY-MM-DD.zip`를 self-hosted target에 `--replace-all`로 import한다.

## 나중에 강화

- Docker image tag pinning과 upgrade runbook 작성.
- frontend static server를 launchd service로 등록.
- Mac mini 재부팅 후 Docker, cloudflared, frontend 자동 시작 확인.
- snapshot ZIP을 외장 디스크나 암호화된 remote backup으로 복제.
- file storage 사용량이 생기면 S3/R2 storage 검토.

## 참고

- Convex Self Hosting: https://docs.convex.dev/self-hosting
- Self-hosted Docker guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- Own infra routing guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md
- Convex Backup & Restore: https://docs.convex.dev/database/backup-restore
- Convex Data Import: https://docs.convex.dev/database/import-export/import
- Convex Auth manual setup: https://labs.convex.dev/auth/setup/manual
