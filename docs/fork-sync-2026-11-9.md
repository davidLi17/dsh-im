# Fork maintenance: 26.11.9-lhg

Base: davidLi17/dsh-im `bbb9846280c202c3a51a22eb944ac7873f74f2d9`.

## Selected fixes

- #540 / `29af086a6c30089068b446c4f7aa8c9534bc990e`: silence successful Weixin steering receipts while preserving queued and failed submission notices.
- #399 / `c471cb8a58334430e89a6ca9ead7b18b7b67bdf1`: preserve Markdown when a final answer falls back from a Feishu card, including long fenced code and its indentation.
- #518 / `1bf85325650e0d59ffb3e3735d8027b39a22765f`: degrade local image links before card rendering and deliver a Goal round's answer when its card cannot be sealed.
- `fc2ceab217309f8973afa03c58cdd8ff3e900130` / issue #537: use one native CommonJS QR loader so repeated plugin/dependency reloads do not leave an empty encoder export.

These are selective adaptations, not a full upstream merge. The local-image adaptation additionally preserves literal Markdown examples in fenced, inline and indented code, and correctly consumes balanced or escaped parentheses in image paths.

All existing channels, Feishu validated authorization-link fallback, safe diagnostics, quoted-image admission, no-extension image detection, admitted-message-only Goal routes, cancellation and optional delivery announcements remain in place. No access policy, account, permission, workflow or dependency change is included. The fork retains esbuild 0.28.2 and React 18.3.1. License and third-party notices are unchanged.

## Verification

- Node 24.22.1; clean locked dependency installation.
- Full `npm run check`: 4,753 passed, zero failures, cancellations or skips; both bundles built and package verification passed.
- Independent review identified and fixed the local-image code-example regression; nine pure-function sanitizer tests passed.
- The first complete run exposed a test-fixture interaction with Node's automatic global proxy. The SDK/Axios test now uses separate agents and temporarily guards the socket boundary, permitting only its own loopback fake proxy. Existing proxy routing assertions remain. It does not change production networking or system proxy settings. Five focused proxy tests and the subsequent complete suite passed.
- Local package: 489 files. Every packaged file byte-matches both the tested source and the installed copy.
- Official DSH 0.2.1-rc.5, normal pnpm 11.25.0 policies: fresh isolated Web-profile installation passed. Host bundle import and `--dump-config` plugin registration passed.
- Package SHA-256: `c5e90f2f33ce9978cccf37cb5092a4807a3024a8e3235966302a95af7af8e935`.

No installer archive was uploaded and no npm release was made. Real Desktop UI and real Feishu-account behavior were not exercised. These fixes do not establish the cause or resolution of an unrelated ZIP delivery failure.

Desktop installation uses the plugin manager Git source `github:davidLi17/dsh-im#main`; restart the Host and refresh the client, then confirm version 26.11.9-lhg. The verified CLI workflow is the official Web profile, not a claim of Desktop installation.
