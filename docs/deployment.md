# Deployment — mobix.asia/docshub_su5

Live at **https://mobix.asia/docshub_su5** on the shared VPS `103.188.83.49`,
alongside the existing `mobix-landing` site. Source lives at `/root/docs-hub-web`.

## Topology

```
internet → mobix-landing-nginx (:80/:443, TLS)
             ├── location /            → app:3000            (landing, pre-existing)
             └── location ^~ /docshub_su5 → docs-hub-web:3000 (this app)
                                              └── https://api.docshub.io.vn (real backend)
```

This app's container publishes no host port. It joins the existing
`mobix-landing_default` network and are reached by container name, so nothing is
exposed to the internet except through the shared nginx.

## Two traps specific to this host

**1. Service names must be unique across the shared network.** Docker publishes
every compose *service name* as a DNS alias on the network it joins. A service
named `app` here made `app` resolve to BOTH this container and the landing app's,
and nginx round-robined between them — mobix.asia served 404 on half its requests.
Hence `docshub-web` / `docshub-mock`, not `app` / `mock`.

**2. Editing `nginx.conf` in place is not enough.** The file is bind-mounted, and
`sed -i` replaces the inode, so the running container keeps serving the old
content — and nginx also caches upstream IPs at start. After changing the proxy
config you must recreate the container, not just reload:

```bash
cd /root/mobix-landing && docker compose up -d --force-recreate nginx
```

## Redeploy

```bash
# from the project root on your machine
tar czf - --exclude node_modules --exclude .next --exclude .git \
  --exclude .env --exclude .env.local . \
  | ssh root@103.188.83.49 'rm -rf /root/docs-hub-web && mkdir -p /root/docs-hub-web \
      && tar xzf - -C /root/docs-hub-web'

ssh root@103.188.83.49 'cd /root/docs-hub-web && docker compose up -d --build'
```

`/root/docs-hub-web/.env` holds `AUTH_SECRET` (generated on the server, chmod 600)
and `NEXT_PUBLIC_BASE_PATH`. It is not in git and is excluded from the transfer —
recreate it if the directory is ever wiped.

## basePath

The app is served from a sub-path, so `NEXT_PUBLIC_BASE_PATH=/docshub_su5` is a
**build argument**: Next inlines it into client bundles, asset URLs and the
router, so it cannot be changed at container start. Changing the path means
rebuilding the image and updating the nginx `location` to match.

## Current data source

The real backend at `https://api.docshub.io.vn` (`API_URL` in
`docker-compose.yml`). The MSW mock service was removed on 24/08/2026: this
deployment exists to verify the API contract, and fixtures prove nothing about
a contract. Data is whatever the backend holds — it survives restarts, and it is
shared with everyone else testing against that backend.

`NEXT_PUBLIC_APP_ENV` is `staging`, not `production`, so the floating API
inspector is mounted. Set it to `production` to hide the inspector.

## Rollback

`nginx.conf` backups are kept beside the original as `nginx.conf.bak.<timestamp>`:

```bash
cd /root/mobix-landing
cp "$(ls -t nginx.conf.bak.* | head -1)" nginx.conf
docker compose up -d --force-recreate nginx
```
