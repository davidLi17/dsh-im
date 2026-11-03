# IM 26.11.3-lhg — 2026-11-03 (Asia/Shanghai)

Base: davidLi17/dsh-im main 0e13b389535005bafca7b3d16b5474d1b41cba11 (26.11.2-lhg).
Upstream assessed: xmanrui/dsh-im main d2f2703dbd2d7adb73fc04b56a12460a39f282dd, merged PR #521 (package 5.9.1).

## Selected functional absorption, not Git ancestry

- #521: distinguish model catalog read failures from missing models. Strict catalog reads are used only for saving; background status retains graceful fallback. A failed selected provider does not mutate persisted selection, unrelated provider failures do not block a valid selection, and cancellation stays cancellation.
- Failed model save closes the menu and shows an inline diagnostic; reopening preserves the previous selection and permits retry. The public catalog error is an owned, translated message. Existing diagnostic allowlists extract facts only, never the provider exception text. No #495 free-text expansion is included.
- Only the upstream source/translation changes and three new existing-style regression tests plus one adjusted test are absorbed. Host/client bundles are rebuilt from this fork, not copied from upstream. MIT license and notices retained.
- All extensionless image detection, optional delivery narration, Feishu QR fallback, quoted images, Goal-card routing, DS Bot defaults/handoff fixes, channels and access policies remain. No media delivery source or channel adapter changed.
- #495/#503/#480 remain excluded as recorded previously. #505 remains unused helper infrastructure. No new dependency, account setting, workflow permission, official client modification, npm release or installation-package upload.

## Verification

- Clean npm ci with normal lifecycle scripts and integrity checks; Node 24.22.1.
- Full npm run check: 4727 passed, 0 failed/cancelled/skipped; Host/client build and package verification pass. Regression coverage includes safe diagnostic propagation, persistence unchanged on failure, provider isolation, inline menu closure/retry, and cancellation. No separate lint/typecheck script exists.
- Repeat build SHA-256 equality and git diff --check pass. npm pack: all 488 files byte-identical to source/generated output. npm cache/home relocated to writable isolated /tmp after initial pack encountered unavailable inherited /home/agent/.npm; no integrity or script-policy override.
- Real QQ/Feishu accounts, live model requests and Windows/macOS Desktop GUI are not tested. Existing ZIP diagnosis still requires actual error details.
- Official DSH 0.2.1-rc.5 isolated Web-profile install from local package passed under normal pnpm 11.25 defaults. All 488 installed files match; Host bundle import and --dump-config auto-registration passed. This does not modify or claim verification of the user's Desktop installation.
- Install using Desktop plugin manager Git source github:davidLi17/dsh-im#main; restart and confirm 26.11.3-lhg. CLI form validated with official Web host: dsh plugin --profile web add -w <package-source>.
