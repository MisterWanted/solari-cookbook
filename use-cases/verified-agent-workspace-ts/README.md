# Verified agent workspace

Run a real web repository in a fresh Solari sandbox, execute its checks, publish
its dev server, and verify the resulting UI from a separate Solari cloud browser.
The output is a durable evidence bundle instead of a bare "agent says done".

The flow is intentionally provider-shaped:

```text
repo/ref -> sandbox -> install -> optional agent -> test -> preview -> browser -> evidence
```

Evidence includes the exact git SHA, command exit codes and output, public preview
URL, browser title, a screenshot, and the screenshot SHA-256 digest.

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
