# English Punch versioning

English Punch uses one public product version in `x.x.x` format. The canonical
source is the root `package.json`. For version `0.3.6`, the same value appears
at these public seams:

- `ep --version` in a tagged CLI release
- MCP initialization and `GET /healthz`
- application backend `GET /health` and `GET /version`
- the version shown at the bottom of the frontend profile drawer
- root and MCP package metadata
- container `org.opencontainers.image.version` labels
- the Argo CD Helm chart's `appVersion`

Run `pnpm run check:version` to verify that package metadata agrees. The CLI
release workflow also requires the Git tag, after removing a leading `v`, to
match the root package version.

## Versions and revisions

The product version describes the English Punch release. Deployment revisions
remain independent and immutable:

- Frontend and MCP images use `sha-<commit>` tags.
- The self-hosted Convex image stays pinned to its own upstream revision.
- The Helm chart package `version` tracks chart packaging changes, while
  `appVersion` tracks the English Punch product version.

The Docker workflow publishes the images and opens one automated infra PR that
updates both SHA image tags and `appVersion`. Argo CD deploys the merged infra
change. The Convex `engineRevision` annotation is operational metadata and must
not be presented as the English Punch product version.

The self-hosted Convex engine reserves its own root `/version` path. Traefik
therefore preserves the public application endpoint `GET /version` while
rewriting it to the application-owned Convex HTTP action at `GET /api/version`.
