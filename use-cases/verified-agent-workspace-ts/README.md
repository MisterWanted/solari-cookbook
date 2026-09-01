# Verified agent workspace

Run a real web repository in a fresh Solari sandbox, execute its checks, publish
its dev server, and verify the resulting UI from a separate Solari cloud browser.
The output is a durable evidence bundle instead of a bare "agent says done".

The flow is intentionally provider-shaped:

```text
repo/ref -> sandbox -> install -> optional agent -> test -> preview -> browser -> evidence
```

Evidence includes the exact git SHA, command exit codes and output, a token-free
preview origin, browser title, a screenshot, and the screenshot SHA-256 digest.
When the worktree changes, evidence also records changed paths and a SHA-256 of
the git diff without persisting the raw patch.

## Why this exists

A green build is not proof that an agent changed the product correctly. Dev servers
can boot while the UI is blank, stale, or functionally wrong. This workflow uses
separate Solari compute and browser sessions so the final assertion observes the
real public preview rather than trusting the process that produced it.

The optional `AGENT_CMD` keeps the executor replaceable: the same verification
path can wrap Pi, Codex, OpenCode, or another coding agent.

## Run

```bash
cp .env.example .env
# edit the values, then export them however you prefer
set -a; . ./.env; set +a
npm install
npm start
```

The target repository must expose a web server on `PORT`. Override the install,
test, and start commands for pnpm, Python, Bun, or another stack. `AGENT_CMD` is
optional: point it at Pi, Codex, OpenCode, or any other CLI present in the VM.
Use `FORWARD_ENV` for an explicit comma-separated allowlist of host environment
variables the agent needs; values are injected into the sandbox and are never
written to evidence.

## Output

A successful run creates:

```text
artifacts/
  evidence.json
  preview.png
```

`evidence.json` is written on both success and failure. A run is only `PASSED`
after every configured command exits successfully and the cloud browser observes
`EXPECT_TEXT` in the real preview.

The sandbox is destroyed in `finally`; the evidence remains local and can be
uploaded to CI, a PR comment, object storage, or an assurance dashboard.

## Live proof

`sample-output/` contains a sanitized copy of a real Solari run. It
verified public branch commit `397e31d723cc31df8b4b9549a0fbccd5b9f43824`
in a fresh sandbox and then asserted `Solari verification passed` from a separate
Solari cloud browser. Signed capability tokens and raw sandbox capabilities are
not persisted. The preview origin is evidence only and may expire after the run.
