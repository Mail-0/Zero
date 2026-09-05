# Experimental mobile packaging

This directory is a Capacitor 8 **build scaffold**, not a completed native mail client.

See [`SELF_HOSTING_IMAP.zh-CN.md`](../../SELF_HOSTING_IMAP.zh-CN.md) for prerequisites, commands and release blockers.

The web assets are copied from `apps/mail/build/client` into `www`; no remote production `server.url` is configured. Platform projects are generated with `npm run add:ios` / `npm run add:android`, then opened in Xcode / Android Studio.

Not implemented: native OAuth/session handoff, Keychain/Keystore storage, deep links, push notifications, background/offline sync and native attachment handling. Do not ship or claim a working mobile login solely because a WebView builds.
