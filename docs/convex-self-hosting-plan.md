# Convex Self-Hosting Plan

Created: 2026-05-08
Last updated: 2026-05-09

## Goals

- Run both the frontend and the self-hosted Convex backend on a Mac mini.
- Use Cloudflare Tunnel to expose the frontend and Convex API/site origins through external HTTPS domains.
- Keep the dashboard accessible only inside Tailscale by default.
- Export data from the existing Convex Cloud dev deployment `strong-otter-914` as a snapshot ZIP, then import it into the self-hosted deployment.
- Run all repository commands with `pnpm`.

## Current Baseline

- Updated repository Convex packages: `convex@1.38.0`, `@convex-dev/auth@0.0.92`, `@convex-dev/eslint-plugin@2.0.0`.
- Source deployment: `dev:strong-otter-914`.
- This app uses the Convex Auth Password provider.
- The only required Convex runtime app secret in the current code is `GEMINI_API_KEY`.
- The current frontend code reads only `VITE_CONVEX_URL`.

## Domains

- `ep.echoja.com`: frontend static app, Mac mini `localhost:4173`
- `ep-convex.echoja.com`: Convex backend/API, Mac mini `localhost:3210`
- `ep-convex-site.echoja.com`: Convex HTTP actions/Auth routes, Mac mini `localhost:3211`
- dashboard: `http://<mac-mini-tailscale-name>:6791` from Tailscale

## Local Files

Do not commit sensitive files, even if they live inside the repository. `.env.convex-*` files are ignored; examples stay tracked.

- `.env.convex-cloud-export`: selects the Convex Cloud source
- `.env.convex-selfhost`: selects the self-hosted Convex target
- Frontend build env belongs in shell env or local `.env.local`.
- Docker backend env belongs outside the repository at `~/services/english-punch-convex/.env`.

```sh
cp .env.convex-cloud-export.example .env.convex-cloud-export
cp .env.convex-selfhost.example .env.convex-selfhost
```

## Environment Responsibilities

### Docker Backend Env

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

### Convex CLI Target Env

`.env.convex-cloud-export`:

```sh
CONVEX_DEPLOYMENT=dev:strong-otter-914
```

`.env.convex-selfhost`:

```sh
CONVEX_SELF_HOSTED_URL=https://ep-convex.echoja.com
CONVEX_SELF_HOSTED_ADMIN_KEY=<generated admin key>
```

### Convex Runtime Env

These are server-side environment variables set inside the self-hosted deployment.

- `GEMINI_API_KEY`: used by `convex/ai.ts`.
- `SITE_URL`: frontend origin. After self-hosting, this is `https://ep.echoja.com`.
- `JWT_PRIVATE_KEY`, `JWKS`: Convex Auth manual setup keys.

`CONVEX_SITE_URL` is used as the issuer domain in `convex/auth.config.ts`. Keep it aligned with the self-hosted backend's `CONVEX_SITE_ORIGIN=https://ep-convex-site.echoja.com`.

### Frontend Build Env

Required only when building the frontend on the Mac mini.

```sh
VITE_CONVEX_URL=https://ep-convex.echoja.com
```

`VITE_CONVEX_SITE_URL` currently has no code usage.

### CLI/MCP Client Env

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

## 1. Start Convex

Run this on the Mac mini.

```sh
mkdir -p ~/services/english-punch-convex
cd ~/services/english-punch-convex
curl -O https://raw.githubusercontent.com/get-convex/convex-backend/main/self-hosted/docker/docker-compose.yml
```

After writing `~/services/english-punch-convex/.env`, start the service.

```sh
docker compose up -d
docker compose ps
docker compose exec backend ./generate_admin_key.sh
```

Put the generated admin key into the repository-local `.env.convex-selfhost` file.

## 2. Cloudflare Tunnel

Add the frontend and Convex entries to the ingress section in `/Users/echoja/.cloudflared/config.yml`.

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

DNS routes:

```sh
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep.echoja.com
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep-convex.echoja.com
cloudflared tunnel route dns 2521553e-c23b-4708-9625-50a9fd65fb49 ep-convex-site.echoja.com
brew services restart cloudflared
```

Health check:

```sh
curl https://ep-convex-site.echoja.com/health
```

## 3. Code Deploy and Runtime Env

With the current Convex CLI, select the self-hosted target through `.env.convex-selfhost`.

```sh
pnpm install --frozen-lockfile
pnpm exec convex deploy --env-file .env.convex-selfhost
```

Check Cloud dev env names:

```sh
pnpm exec convex env --env-file .env.convex-cloud-export list
```

Set self-hosted runtime env:

```sh
pnpm exec convex env --env-file .env.convex-selfhost set SITE_URL https://ep.echoja.com
pnpm exec convex env --env-file .env.convex-selfhost set GEMINI_API_KEY "$GEMINI_API_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set JWT_PRIVATE_KEY "$JWT_PRIVATE_KEY"
pnpm exec convex env --env-file .env.convex-selfhost set JWKS "$JWKS"
pnpm exec convex env --env-file .env.convex-selfhost list
```

## 4. Data Migration

Store snapshots outside the repository.

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

Import into the self-hosted target.

```sh
pnpm exec convex import \
  --env-file .env.convex-selfhost \
  --replace-all \
  -y \
  "$SNAPSHOT"
```

`--replace-all` makes the entire target deployment match the snapshot. Do not run it against the Cloud source.

## 5. Frontend Hosting

Build on the Mac mini.

```sh
VITE_CONVEX_URL=https://ep-convex.echoja.com pnpm build
```

For the first production run, serve `dist/` from a static server on `127.0.0.1:4173`. With Caddy:

```sh
caddy file-server --listen 127.0.0.1:4173 --root dist
```

Until this is pinned as a launchd service, manually confirm that the frontend, Docker, and cloudflared are all running.

## 6. Verification

```sh
curl https://ep-convex-site.echoja.com/health
curl -I https://ep.echoja.com
pnpm exec convex data --env-file .env.convex-selfhost
pnpm exec convex data --env-file .env.convex-selfhost users --limit 5
pnpm exec convex data --env-file .env.convex-selfhost authAccounts --limit 5
```

Verify in the browser:

- Open `https://ep.echoja.com`.
- Sign in with an existing account email and password.
- Check the bag/card list.
- Create, edit, and delete cards.
- Generate a Gemini card draft.
- Confirm that the Go CLI and MCP server point to `https://ep-convex.echoja.com`.

## 7. Cutover

1. Start Convex Docker.
2. Connect `ep.echoja.com`, `ep-convex.echoja.com`, and `ep-convex-site.echoja.com` through Cloudflare Tunnel.
3. Deploy code to self-hosted Convex.
4. Set self-hosted Convex runtime env.
5. Export the final snapshot from Cloud dev.
6. Import into self-hosted Convex with `--replace-all`.
7. Build the frontend with `VITE_CONVEX_URL=https://ep-convex.echoja.com` and deploy it to the static server.
8. Verify key workflows at `https://ep.echoja.com`.
9. Switch CLI/MCP client env to the self-hosted URL.
10. Keep the Cloud deployment as a rollback candidate for a few days.

## 8. Backup and Rollback

Production backup:

```sh
BACKUP_DIR=~/Backups/english-punch/convex
TODAY=$(date +%Y-%m-%d)

pnpm exec convex export \
  --env-file .env.convex-selfhost \
  --include-file-storage \
  --path "$BACKUP_DIR/selfhost-$TODAY.zip"
```

Rollback:

- Frontend problem: restore the `ep.echoja.com` static server to the previous build.
- Convex cutover problem: rebuild the frontend with the previous Cloud URL and use the Cloud deployment.
- Self-hosted data problem: import the last known-good `selfhost-YYYY-MM-DD.zip` into the self-hosted target with `--replace-all`.

## Future Hardening

- Pin Docker image tags and write an upgrade runbook.
- Register the frontend static server as a launchd service.
- Confirm that Docker, cloudflared, and the frontend start automatically after a Mac mini reboot.
- Replicate snapshot ZIP files to an external disk or encrypted remote backup.
- Consider S3/R2 storage when file storage usage appears.

## References

- Convex Self Hosting: https://docs.convex.dev/self-hosting
- Self-hosted Docker guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- Own infra routing guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md
- Convex Backup & Restore: https://docs.convex.dev/database/backup-restore
- Convex Data Import: https://docs.convex.dev/database/import-export/import
- Convex Auth manual setup: https://labs.convex.dev/auth/setup/manual
