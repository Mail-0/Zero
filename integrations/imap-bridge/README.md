# Zero IMAP bridge (experimental)

A single-instance Node service for IMAPS/SMTP and per-user Chat Completions-compatible BYOK, called only by the authenticated Zero backend. Not an anonymous/public mail relay. The service secret must never reach a browser or a mobile app.

See [`SELF_HOSTING_IMAP.zh-CN.md`](../../SELF_HOSTING_IMAP.zh-CN.md) for the complete deployment and limitations guide.

```sh
node scripts/init-env.mjs
# Edit the ignored .env to allow your additional mail/AI hosts.
docker compose up -d --build
curl --fail http://127.0.0.1:3033/healthz
```

Docker deploys only this bridge. The existing Zero frontend/auth/Cloudflare backend must still be configured separately. Native packaging elsewhere in the repository is a scaffold, not a finished mobile client.

Unit tests (`npm test`) inject mail dependencies and need no network. `npm run test:dependencies` requires installing the real packages. Do not interpret unit tests as real QQ/163 validation.
