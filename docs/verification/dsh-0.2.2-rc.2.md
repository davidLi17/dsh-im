# DSH 0.2.2-rc.2 verification

Plugin: `26.11.12-lhg`, based on fork main
`43e2ded7cc099e8358765e1f30dcd9b1244b0489`.
Upstream: `xmanrui/dsh-im` remained at
`fc2ceab217309f8973afa03c58cdd8ff3e900130`; its selected fixes are already
recorded in `docs/fork-sync-2026-11-9.md`. No new upstream channel code is merged.

## Host identity and build

- New release: official `deepseek-ai/deepseek-harness` tag
  `dsh-v0.2.2-rc.2`, commit `ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c`.
- Previous baseline: `dsh-v0.2.2-rc.1`, commit
  `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db`.
- At verification time, the GitHub rc.2 release existed but had no assets;
  npm still reported `latest` and `next` as `0.2.2-rc.1`, and an exact rc.2
  npm installation returned `ETARGET`. The rc.2 tests therefore use the
  official source tag's built CLI and packages, not a published npm rc.2.
- Source dependencies installed with the frozen pnpm lockfile. Official Node
  24.22.1, including development headers, was checked against its published
  SHA-256 before building. Host native addon, Typert generation, Host and Client
  TypeScript compilation, Host/Client bundles, Desktop bundle and Web build
  completed. The source checkout's tracked files stayed unchanged.
- The aggregate build initially hit this environment's tsx CLI IPC restriction;
  direct `node --import tsx` execution of the same official build scripts
  avoided the optional CLI IPC. The all-workspace tsdown process was also
  killed under concurrent load. The same official root configuration succeeded
  with repeated `--filter <workspace-directory>` selections in 16 Host batches
  and 10 Client batches. No package checks were disabled and no build source,
  dependency pin, security setting or permission was changed. This records
  successful artifact stages, not a claim that the original aggregate command
  or the upstream repository's entire test suite passed.

Release: https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.2

## Changes checked against the tag

- Session array append is additive: ordinary single-event calls remain valid.
  The plugin does not replace `Session.append`. Its title listener queues work
  after publication and reads the latest title. The new opt-in real-host test
  commits a user message and two titles in one batch, verifies complete-batch
  visibility, and checks that only the final title is prefixed once, in order.
- Named subagents, Team ownership, and empty retry prompts changed in the Host.
  IM continues to use the existing Session/Gateway request APIs and caller peer;
  no retired Team methods or custom subagent runtime implementation is used.
- `settings.describe()`, `settings/document-updated`, `locale.preference`, and
  `settings.section` remain available. The added HOC slot kind does not change
  this plugin's list-slot registration. Real language RPC and restart tests
  exercise the existing adapter.
- Removed `useAnchoredPosition` / `Menu.getAnchorRect` exports and
  `BundleInfo.updatable` have no production consumers in this plugin.
  Account, search, Office and Computer Use migration settings are not modified.
- JSONL remains Session format V4. The bundled context hook is checked through
  real persistence create/append/reopen/read, including the next turn.
- Existing channel implementations, group profiles, delivery/resend behavior,
  validated Feishu authorization-link fallback, quoted-image admission, access
  controls and license notices are unchanged. No older-host fallback branch or
  speculative runtime shim is added.

## Reproduction

With `HOST` pointing to the built official rc.2 source checkout:

```sh
export DSH_HOME="$(mktemp -d)"
npm ci
npm run check
npm pack --pack-destination /tmp
DSH_IM_VERIFY_TARBALL=/tmp/xmanrui-dsh-im-26.11.12-lhg.tgz \
  node scripts/verify-interface-language.mjs "$HOST"
node scripts/verify-lan-management.mjs "$HOST"
node scripts/verify-injected-context.mjs "$HOST"
node scripts/verify-session-title-prefix.mjs "$HOST" all-prompts --batch-append
node scripts/verify-session-title-prefix.mjs "$HOST" first-prompt --batch-append
```

The interface-language script installs the actual tarball through the unmodified
`dsh plugin --profile web add` command in its own temporary profile. It links
base/web packages from the supplied official build, performs authenticated HTTP
RPCs, and removes its temporary profile when finished. The LAN test sends Host
and Origin headers over loopback; it does not expose a network listener or test
another device. Leave `DSH_IM_TELEGRAM_TOKEN` unset for credential-free checks.

For the rc.1 regression lane, use the installed official
`@deepseek-ai/dsh@0.2.2-rc.1` package directory as `HOST`, run language,
context and both title checks, and omit `--batch-append`.

## Recorded result (2026-11-12, Linux)

- Final `npm run check`: 4,753 passed, zero failed/cancelled/skipped; both plugin
  bundles built and package verification passed.
- Final package: all 489 packaged files byte-match the tested source; SHA-256
  `f7d6dddcbe51180a8aca9868543b5144b4e22246193d02fd291df64ae3f54ec5`.
- rc.2 official CLI tarball installation and language behavior: 9 real HTTP
  checks passed, including live language changes, malformed-input rejection,
  precedence and restart persistence.
- rc.2 management authority: 71 real HTTP checks passed across loopback, trusted
  LAN/domain authorities, authentication and mismatched-Origin rejection.
- rc.2 real V4 JSONL context persistence: all 6 cases passed. Both automatic
  title policies and the new array-append cases passed.
- rc.1 official npm Host regression: the final tarball installed successfully;
  9 language HTTP checks, 6 JSONL cases and both title policies passed.
- `git diff --check` passed. Existing `lib/client.js` executable mode is retained.

This establishes the tested Linux Web-profile package and service behavior.
It does not claim live bot login, external IM delivery, desktop installation,
full browser rendering, native Windows/macOS testing or future-host support.
No installer archive is uploaded and no npm release is made. The existing CI
workflow is left unchanged; remote run status must be checked for the published
commit separately.

Install the fork through DSH's plugin manager Git source
`github:davidLi17/dsh-im#main`, or use the matching profile explicitly:

```sh
dsh plugin --profile desktop add github:davidLi17/dsh-im#main
# For a Web installation instead:
dsh plugin --profile web add github:davidLi17/dsh-im#main
```

Restart the Host and refresh the client, then verify `26.11.12-lhg`. These are
installation instructions for the user's chosen profile; they do not imply that
this verification changed the user's running installation.
