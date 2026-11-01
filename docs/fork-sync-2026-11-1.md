# IM 26.11.1-lhg — 2026-11-01 (Asia/Shanghai)

Base: davidLi17/dsh-im main 76e7baae936877a1e7b7fb8d39ea8dd872a22493 (26.10.31-lhg.2).
Upstream assessed: xmanrui/dsh-im main 14f8648e49502bad6b5caf54fea7b7c77dcdfb0c; latest package version 5.9.1.

## Selected functional absorption (not Git ancestry)

- #500 / c1e704c3d4765b6aa3a9ebe576256196617d772b: existing bound Feishu conversations display automatic Goal-round progress and results, hide the driver prompt, deduplicate synced DMs, and handle lost turn-end events and session rebinding. Only bridge, two translation files and the focused upstream regression file were absorbed; upstream bundles and unrelated changes were not copied.
- #504 / 4ef05eb27d3b9bafccd00dd092bcc7b738d9ed1a: record outbound email Message-IDs so parent-only replies (e.g. iOS Mail) reuse the original session. Runtime plus one upstream regression absorbed.
- Two narrowly scoped fork corrections to #500: remember reply routes only after existing inbound access checks allow the message; hand over IM-owned turns before stale-Goal cleanup so the active card is not sealed. Each regression failed against the corresponding uncorrected implementation and passed after the correction.

## User-reported extensionless image repair

- User report: `codex_image_generate` returns a PNG at a path named `original`; extension-only classification sent it as a generic QQ file. This is a fork fix, not an upstream absorption.
- Unknown/missing extensions now identify PNG/JPEG/GIF/WebP from the first 12 bytes collected during the existing managed-snapshot SHA-256 stream. Known extensions take precedence. No additional source reopen, transcoding, filename mutation, dependency or caller-supplied MIME field. Existing snapshot integrity/cancellation/cleanup and shared image-first fallback remain.
- QQ native image delivery already uses the bytes buffer, independent of filename; no QQ-specific code change.
- One table-driven regression covers 14 cases (four formats, both GIF variants, unknown extension, known type precedence, empty/truncated/non-image/RIFF-WAVE) through registration and delivery, verifying byte/name preservation and sender selection. The original code fails this regression; the patch passes.

## Assessed but not adopted

- #495 / 713b1c413b3b783a411608668047b0591423ca4b: adds free-form-ish causeMessage matching. Existing fork safely preserves official QR authorization links and diagnostic stages/codes; the new broad textual shapes are not an equivalent replacement for that design. Keep existing diagnostics and QR fallback.
- #503 / feb27953bd92f350b8b315fe1c56cb0751ff62aa: changes management access authority for LAN settings/update endpoints; not needed for this Desktop user and not adopted under the unchanged access-policy requirement.
- #480 / 14f8648e49502bad6b5caf54fea7b7c77dcdfb0c: wider non-IM delivery/settings/coordinator work depends on the previously excluded #470 conversation-identity API. Not included in this minimal delivery repair.
- Existing #384/#482/#490/#491/#493, quoted-image/QR customizations and esbuild 0.28.2 remain; none is counted as new.

## Preservation

No credentials, access settings, platform permissions, dependencies, workflows or DSH official code were changed. Goal continuation is not enabled or initiated by this patch: it only displays already-running goal rounds from accepted, bound conversations. QR-link validation/polling, quoted image admission, group history/file limits, retries, ordinary file handling and all existing channels remain. MIT copyright and third-party notices retained.

## Verification

- Node 24.22.1; clean npm ci with normal scripts and integrity checks passed. Isolated writable HOME/XDG directories were required by this execution environment; no supply-chain checks were disabled.
- Final full suite: 4706 passed, 0 failed/cancelled/skipped. Includes 10 Goal tests (8 upstream + 2 minimal fork regressions). No separate lint/typecheck script exists in this JavaScript package.
- Host/client build, verify-package and git diff --check passed. Rebuilding produced identical SHA-256 hashes.
- npm pack: 488 files, all byte-identical to the checked working tree. Archive kept locally; no archive/npm upload.
- Official @deepseek-ai/dsh 0.2.1-rc.5 isolated Web-profile local-package installation passed with default pnpm 11.25 policies. Installed manifest, Cordis patch and both bundles match; installed Host bundle import passed.
- rc.5 published goal-round-driver source emits source.kind=goal with round; agent-loop emits turn/start before user/message, whose Goal payload omits turn. This matches the imported event handling.
- Real QQ/Feishu/email accounts, Windows/macOS Desktop GUI and live multi-round model execution were not exercised. The existing ZIP回传 MF-7005A850 report remains unresolved pending its diagnostic details.

Installation after publication: Desktop plugin manager Git source `github:davidLi17/dsh-im#main`, then restart. Web command: `dsh plugin --profile web add -w 'github:davidLi17/dsh-im#main'`.

The earlier local candidate cec09c6d was not published. Its 14 recovered files reproduce tree 0f885dacfe668cbfa22428ddd61f5c7692acc64b before this additional image fix; this final candidate is independently re-tested and rebuilt. The connected Windows computer is not authorized for task access, so actual running Desktop reload and the QQ automatic-meme flow require user verification after updating.
