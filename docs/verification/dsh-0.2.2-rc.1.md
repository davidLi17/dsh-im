# DSH 0.2.2-rc.1 verification

Host: official npm `@deepseek-ai/dsh@0.2.2-rc.1`; source tag
`dsh-v0.2.2-rc.1`, commit `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db`.
Plugin: `26.11.10-lhg`.

The existing production adapter already reads `settings.describe()` and watches
`settings/document-updated`. The rc.1 locale entry remains `locale.preference`.
No speculative runtime shims were added. Existing user customizations, access
policies, gateway caller identities and channel implementations are retained.

Verification scripts were updated for actual npm hoisted layouts. rc.1 locale
changes now go through the isolated profile's `cordis.patch.yml`, not the retired
`settings.yaml`. JSONL persistence now exposes a named `apply` entry; the title
service now injects the actual AgentRegistry. These are test-harness changes,
not changes to the plugin's production channel behavior.

Reproduce with an installed official host package directory in `HOST`:

```sh
export DSH_HOME="$(mktemp -d)"
npm ci
npm run check
npm pack --pack-destination /tmp
DSH_IM_VERIFY_TARBALL=/tmp/xmanrui-dsh-im-26.11.10-lhg.tgz \
  node scripts/verify-interface-language.mjs "$HOST"
node scripts/verify-injected-context.mjs "$HOST"
node scripts/verify-session-title-prefix.mjs "$HOST" all-prompts
node scripts/verify-session-title-prefix.mjs "$HOST" first-prompt
```

Unset `DSH_IM_TELEGRAM_TOKEN` for offline-account testing. The language script
creates and removes its own isolated profile, installs the tarball with the
unmodified `dsh plugin --profile web add` command, and checks real authenticated
HTTP RPCs, locale live updates, precedence, malformed-input rejection, restart
persistence and explicit operator configuration. Base/web host packages are
linked from the supplied official installation; the plugin itself is installed
from its tarball. The persistence script checks six input shapes through the
bundled hook and actual V4 JSONL create/append/reopen/read. Title tests use real
host session, projection, agent registry and title services with a local title
provider and no LLM calls.

This establishes host loading, package installation and the tested service
contracts. It does not claim live IM delivery, external bot login, full browser
rendering, Windows/macOS coverage or future DSH version compatibility. No live
accounts, IM messages or extension permissions are involved.

## Recorded result (2026-11-10, Linux, Node 24.22.1)

- `npm run check`: 4,753 tests passed, 0 failed/skipped; build and package checks passed.
- Final `npm pack`: 489 files; packed plugin official-install lane: 9 checks passed.
- Real JSONL persistence: 6 cases passed.
- Real title services: both `all-prompts` and `first-prompt` passed.
- `git diff --check`: passed. No npm publication, package upload or remote push.
