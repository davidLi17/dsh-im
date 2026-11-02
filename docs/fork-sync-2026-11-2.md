# IM 26.11.2-lhg — 2026-11-02 (Asia/Shanghai)

Base: davidLi17/dsh-im main 7d2aaaa3769ea1fcc8c7e9e685d303796a2e916f (26.11.1-lhg.2).
Upstream assessed: xmanrui/dsh-im main dd500d24252a182ca64645ada005a553fd723831 (package 5.9.1).

## Selected functional absorption, not Git ancestry

- #513 / 34c8b0f3b1a0a8a8c93f44c2b16a6703228c814a: read the bound Session's effective default reasoning effort after a DS Bot model change with no explicit effort, avoiding a false failure. Source and existing fixture/assertions absorbed, not upstream bundles. The old implementation fails the adjusted default-effort regression, while the fix passes.
- #499 / 804be5f7e7a7f0a4e168a22b54e35bc6850b6650: follow an accepted prompt across DS Bot archived/blocked handoffs by its original RPC identity rather than resubmitting. Preserve cancellation, stale-binding checks, paginated reply identity, staged input lifetime, progress and deferred-delivery metadata. Three source files and the focused upstream regression tests absorbed. Only patch context at the import was adapted; the unrelated ensurePresetWorkspace feature was not introduced. Required session-binding locks and prompt identity tracking already exist in this fork, so #480/#470 are not prerequisites for this selected patch.

## Assessed, not adopted

- #505 / b78e1e6c427af33f3f07ea24940a7ecdb09acdc5: shared Telegram card-retry and label-sanitizing helpers are not called by any production source at assessed main; disabled-button support is future infrastructure. Do not publish unused helpers as an actual user-visible fix.
- #495/#503/#480 remain excluded for the reasons recorded in fork-sync-2026-11-1.md. No new host identity API, management access policy, or non-IM outbound delivery is enabled.
- Existing #500/#504, extensionless image signatures, optional delivery narration, QR link validation/polling, redacted diagnostics, referenced images, all channels, cancellation and group-history/access checks remain.

No dependencies, account settings, credentials, platform permissions, workflow policies, official DSH client code or npm publication changed. MIT copyright and third-party notices retained. Tests are selected existing upstream regressions, with no additional fork-only test scaffolding.

## Verification

- Clean npm ci with normal scripts and integrity checks, Node 24.22.1. HOME/npm-cache/XDG data locations were set to writable isolated /tmp directories after the inherited home path caused a cache/store error; no policy or integrity bypass.
- 51 targeted tests passed. Both default-effort and archived-handoff regression fail against the previous source and pass with these patches.
- Full suite: 4724 passed, 0 failed/cancelled/skipped. Host/client build, verify-package, git diff --check and repeat-build SHA-256 equality passed. No separate lint/typecheck script exists.
- npm pack contains 488 files matching the working tree. Official DSH 0.2.1-rc.5 isolated Web-profile installation from the local package passed with normal pnpm 11.25 defaults; all 488 files match and Host bundle import passed.
- Real QQ/Feishu/DS Bot accounts, live model execution, and Windows/macOS Desktop GUI were not tested. The separately reported ZIP failure still needs its diagnostic details. Current fork has no prior Actions runs; exact final SHA is checked after publication.
- Installation after publication: Desktop plugin manager Git source github:davidLi17/dsh-im#main, restart and confirm 26.11.2-lhg. Verified CLI form: dsh plugin --profile web add -w 'github:davidLi17/dsh-im#main'.
