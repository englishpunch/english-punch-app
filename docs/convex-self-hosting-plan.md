# Convex Self-Hosting Runbook

Created: 2026-05-08
Last updated: 2026-06-24

## Current State

- Active Convex deployment: `https://ep-convex.echoja.com`.
- Active Convex site origin: `https://ep-convex-site.echoja.com`.
- Active frontend origin: `https://ep.echoja.com`.
- The old Convex Cloud dev deployment `dev:strong-otter-914` was migrated on 2026-06-24 and is no longer part of normal development, testing, deployment, or rollback.
- This app uses the Convex Auth Password provider with manual self-hosted Auth keys.
- The frontend code reads `VITE_CONVEX_URL`; `VITE_CONVEX_SITE_URL` is tracked for consistency.

## Domains

- `ep.echoja.com`: frontend static app, Mac mini `localhost:4173`
- `ep-convex.echoja.com`: Convex backend/API, Mac mini `localhost:3210`
- `ep-convex-site.echoja.com`: Convex HTTP actions/Auth routes, Mac mini `localhost:3211`
- dashboard: `http://127.0.0.1:6791` on the Mac mini, or `http://<mac-mini-tailscale-name>:6791` from Tailscale

## Local Files

Do not commit sensitive files, even if they live inside the repository.

- `.env.local`: frontend development/build URLs
- `.env.convex-selfhost`: Convex CLI target for the self-hosted deployment
- `.env.convex-runtime`: local-only runtime secrets to set inside Convex
- `~/services/english-punch-convex/.env`: Docker backend env outside the repository

Do not set `CONVEX_DEPLOYMENT` in repository env files. That variable selects a Convex Cloud deployment and conflicts with the self-hosted target.

```sh
cp .env.convex-selfhost.example .env.convex-selfhost
touch .env.convex-runtime
```

`.env.local`:

```env
VITE_CONVEX_URL=https://ep-convex.echoja.com
VITE_CONVEX_SITE_URL=https://ep-convex-site.echoja.com
```

`.env.convex-selfhost`:

```sh
CONVEX_SELF_HOSTED_URL=https://ep-convex.echoja.com
CONVEX_SELF_HOSTED_ADMIN_KEY='<generated admin key>'
```

## Dashboard Admin Key

The dashboard password is the self-hosted admin key from `.env.convex-selfhost`. Paste the full `CONVEX_SELF_HOSTED_ADMIN_KEY` value without the surrounding quotes.

To copy the exact key without printing it:

```sh
( set -a; source .env.convex-selfhost; set +a; printf '%s' "$CONVEX_SELF_HOSTED_ADMIN_KEY" | pbcopy )
```

To verify the key without printing it:

```sh
(
  set -a
  source .env.convex-selfhost
  set +a
  curl -fsS \
    -H "Authorization: Convex $CONVEX_SELF_HOSTED_ADMIN_KEY" \
    "$CONVEX_SELF_HOSTED_URL/api/check_admin_key" >/dev/null
)
```

If the dashboard reports `BadAdminKey`, clear site data/localStorage for `127.0.0.1:6791` and paste the key again. The most common causes are copying the quotes or using an older generated key.

## Docker Backend Env

`~/services/english-punch-convex/.env`:

```sh
INSTANCE_NAME=english-punch
INSTANCE_SECRET=<openssl rand -hex 32>

CONVEX_CLOUD_ORIGIN=https://ep-convex.echoja.com
CONVEX_SITE_ORIGIN=https://ep-convex-site.echoja.com
NEXT_PUBLIC_DEPLOYMENT_URL=https://ep-convex.echoja.com

FRONTEND_PORT=4173
FRONTEND_DIST=/Users/echoja/works/english-punch-app/dist

REDACT_LOGS_TO_CLIENT=true
DISABLE_BEACON=true
```

Start or restart the stack:

```sh
cd ~/services/english-punch-convex
docker compose up -d
docker compose ps
```

Generate a new admin key only if the instance secret changes:

```sh
docker compose exec backend ./generate_admin_key.sh
```

## Cloudflare Tunnel

This Mac mini runs cloudflared through `~/Library/LaunchAgents/com.cloudflare.cloudflared.plist`, not the Homebrew service.

Required ingress entries in `/Users/echoja/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: ep.echoja.com
    service: http://localhost:4173
  - hostname: ep-convex.echoja.com
    service: http://localhost:3210
  - hostname: ep-convex-site.echoja.com
    service: http://localhost:3211
  - service: http_status:404
```

Restart cloudflared after config changes:

```sh
launchctl kickstart -k "gui/$(id -u)/com.cloudflare.cloudflared"
```

## Convex Runtime Env

These are server-side environment variables set inside the self-hosted deployment.

- `GEMINI_API_KEY`: used by `convex/ai.ts`
- `SITE_URL`: `https://ep.echoja.com`
- `JWT_PRIVATE_KEY`, `JWKS`: Convex Auth manual setup keys

`CONVEX_SITE_URL` is used as the issuer domain in `convex/auth.config.ts`. Keep it aligned with `CONVEX_SITE_ORIGIN=https://ep-convex-site.echoja.com`.

Generate fresh Convex Auth keys if creating a new instance:

```sh
node - <<'NODE' >> .env.convex-runtime
const { generateKeyPairSync } = require("node:crypto");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { format: "jwk" },
});
const escapedPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
process.stdout.write(`JWT_PRIVATE_KEY="${escapedPrivateKey}"\n`);
process.stdout.write(`JWKS='${jwks}'\n`);
NODE
```

Set runtime env values:

```sh
(
  set -a
  source .env.convex-selfhost
  source .env.convex-runtime
  set +a
  GEMINI_TMP=$(mktemp)
  JWT_TMP=$(mktemp)
  JWKS_TMP=$(mktemp)
  trap 'rm -f "$GEMINI_TMP" "$JWT_TMP" "$JWKS_TMP"' EXIT
  printf '%s' "$GEMINI_API_KEY" > "$GEMINI_TMP"
  printf '%s' "$JWT_PRIVATE_KEY" > "$JWT_TMP"
  printf '%s' "$JWKS" > "$JWKS_TMP"
  pnpm exec convex env set SITE_URL https://ep.echoja.com
  pnpm exec convex env set GEMINI_API_KEY --from-file "$GEMINI_TMP"
  pnpm exec convex env set JWT_PRIVATE_KEY --from-file "$JWT_TMP"
  pnpm exec convex env set JWKS --from-file "$JWKS_TMP"
)
```

Do not run `pnpm exec convex env list` in shared logs after setting secrets; it prints values, not only names.

## Development Flow

Install dependencies:

```sh
pnpm install --frozen-lockfile
```

Start local frontend development plus Convex code watch:

```sh
pnpm run dev
```

`pnpm run dev` runs:

- `vite` for the local frontend development server
- `convex dev --env-file .env.convex-selfhost` for the shared self-hosted backend

Backend schema/functions are pushed to the self-hosted deployment during development. Treat this as a shared dev/prod backend until a separate self-hosted staging instance exists.

## Test Flow

Run focused checks while editing:

```sh
pnpm test
pnpm lint
cd cli && go test ./...
pnpm --filter @english-punch/mcp-server build
```

Run the repository check before committing:

```sh
pnpm run check
```

Use `pnpm run check:all` for the broader CI-equivalent local check.

## Deploy Flow

Deploy Convex functions/schema:

```sh
pnpm exec convex deploy --env-file .env.convex-selfhost
```

Build the frontend:

```sh
pnpm build
```

The Docker Compose stack serves `dist/` through Caddy:

```caddy
:80 {
  root * /srv
  try_files {path} /index.html
  file_server
}
```

Compose service:

```yaml
frontend:
  image: caddy:2-alpine
  restart: unless-stopped
  ports:
    - "127.0.0.1:${FRONTEND_PORT:-4173}:80"
  volumes:
    - "${FRONTEND_DIST:-/Users/echoja/works/english-punch-app/dist}:/srv:ro"
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
```

After every frontend rebuild, Caddy serves the updated `dist/` contents through the bind mount.

## Verification

```sh
curl https://ep-convex-site.echoja.com/health
curl -I https://ep.echoja.com
( set -a; source .env.convex-selfhost; set +a; pnpm exec convex data users --limit 5 )
( set -a; source .env.convex-selfhost; set +a; pnpm exec convex data authAccounts --limit 5 )
```

Verify in the browser:

- Open `https://ep.echoja.com`.
- Sign in with an existing account email and password.
- Check the bag/card list.
- Create, edit, and delete cards.
- Generate a Gemini card draft.
- Confirm that the Go CLI and MCP server point to `https://ep-convex.echoja.com`.

## Backup and Restore

Production backup:

```sh
BACKUP_DIR=~/Backups/english-punch/convex
TODAY=$(date +%Y-%m-%d)

(
  set -a
  source .env.convex-selfhost
  set +a
  pnpm exec convex export \
    --include-file-storage \
    --path "$BACKUP_DIR/selfhost-$TODAY.zip"
)
```

Restore the last known-good self-hosted snapshot:

```sh
(
  set -a
  source .env.convex-selfhost
  set +a
  pnpm exec convex import \
    --replace-all \
    -y \
    "$BACKUP_DIR/selfhost-YYYY-MM-DD.zip"
)
```

`--replace-all` makes the entire target deployment match the snapshot. Do not run it unless you intentionally want to replace the current self-hosted data.

## Historical Cutover Record

- Cloud dev source: `dev:strong-otter-914`
- Final Cloud snapshot: `~/Backups/english-punch/convex/cloud-final-2026-06-24.zip`
- Sanitized import snapshot: `~/Backups/english-punch/convex/cloud-final-2026-06-24-no-component-storage.zip`
- Import result: 13,789 documents
- Verified counts after import: `activities=2672`, `authAccounts=56`, `bags=4`, `cards=2031`, `reviewLogs=1362`, `users=56`

The sanitized snapshot removed only the empty `_components/dueCardsByBag/_storage/documents.jsonl` entry after the first import failed with a component `_file_storage` table ID conflict.

## Future Hardening

- Pin Docker image tags and write an upgrade runbook.
- Confirm Docker and cloudflared restart automatically after a Mac mini reboot.
- Replicate snapshot ZIP files to an external disk or encrypted remote backup.
- Add a separate self-hosted staging deployment if backend changes need isolation from production data.
- Consider S3/R2 storage when file storage usage appears.

## References

- Convex Self Hosting: https://docs.convex.dev/self-hosting
- Self-hosted Docker guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- Own infra routing guide: https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md
- Convex Backup & Restore: https://docs.convex.dev/database/backup-restore
- Convex Data Import: https://docs.convex.dev/database/import-export/import
- Convex Auth manual setup: https://labs.convex.dev/auth/setup/manual
