import { SolariClient } from "@solarisdk/sdk"
import { Solari } from "@solarisdk/browser"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"

const SOLARI_API_KEY = process.env.SOLARI_API_KEY
const AGENT_API_KEY = process.env.ZAI_CODING_PLAN_API_KEY
if (!SOLARI_API_KEY) throw new Error("Missing SOLARI_API_KEY")
if (!AGENT_API_KEY) throw new Error("Missing ZAI_CODING_PLAN_API_KEY")

const repo = "https://github.com/Marthijs-Berfelo/buddy-harmony.git"
const ref = "9a6fea34db91d535b9d4e255d19c130704da3d61"
const model = "glm-5.3"
const port = 4173
const nodeVersion = "24.15.0"
const nodePath = "export PATH=/opt/node/bin:$PATH; "
const vitePreviewHostEnv = "export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.preview.getsolari.com; "
const cwd = "/workspace/repo"
const artifacts = new URL("../artifacts-buddy/", import.meta.url)
const allowlist = [
  "src/common/layout/Header.tsx",
  "src/common/layout/components/LanguageSelector.tsx",
  "src/common/toolbar/components/SettingsTools.tsx",
  "src/common/toolbar/Toolbar.tsx",
  "public/locales/en/common.json",
  "public/locales/nl/common.json",
  "public/locales/en/settings.json",
  "public/locales/nl/settings.json",
]

const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const publicUrl = (value) => `${new URL(value).origin}/`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const scrub = (value, limit = 12000) => {
  let text = String(value ?? "")
  for (const secret of [SOLARI_API_KEY, AGENT_API_KEY]) if (secret) text = text.split(secret).join("[REDACTED]")
  text = text.split(cwd).join("[workspace]")
  text = text.replace(/\bslr_live_[A-Za-z0-9_-]+\b/g, "[REDACTED_SOLARI_KEY]")
  return text.slice(-limit)
}

async function run(sandbox, command, timeoutMs = 8 * 60_000) {
  const r = await sandbox.commands.run("sh", { args: ["-lc", command], cwd, timeoutMs })
  return { command, exitCode: r.exitCode, stdout: scrub(r.stdout), stderr: scrub(r.stderr) }
}
async function must(sandbox, command, timeoutMs) {
  const r = await run(sandbox, command, timeoutMs)
  if (r.exitCode !== 0) throw new Error(`${command} failed (${r.exitCode})\n${r.stderr}`)
  return r
}
async function waitHttp(url) {
  let last = ""
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(url); if (r.ok) return; last = `HTTP ${r.status}` } catch (e) { last = String(e) }
    await sleep(1000)
  }
  throw new Error(`preview did not become ready: ${last}`)
}

async function inspectAx(url, screenshotName) {
  const solari = new Solari({ apiKey: SOLARI_API_KEY })
  const browser = await solari.launch()
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: "networkidle" })
    await page.evaluate(() => { history.pushState({}, "", "/scale"); window.dispatchEvent(new PopStateEvent("popstate")) })
    await page.waitForSelector("#scale-page")
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Accessibility.enable")
    const tree = await cdp.send("Accessibility.getFullAXTree")
    const buttons = tree.nodes.filter((n) => n.role?.value === "button")
    const names = buttons.map((n) => typeof n.name?.value === "string" ? n.name.value : "")
    const unnamed = names.filter((name) => !name.trim()).length
    const screenshotPath = new URL(screenshotName, artifacts)
    await page.screenshot({ path: screenshotPath.pathname, fullPage: true })
    const bytes = await readFile(screenshotPath)
    return { buttonCount: buttons.length, unnamedButtonCount: unnamed, buttonNames: names, screenshot: screenshotName, screenshotSha256: sha256(bytes) }
  } finally {
    await browser.close()
    await solari.close()
  }
}

const agentSource = await readFile(new URL("./buddy-harmony-agent.mjs", import.meta.url), "utf8")

await mkdir(artifacts, { recursive: true })
const client = new SolariClient({ apiKey: SOLARI_API_KEY })
let sandbox
const evidence = { version: 1, startedAt: new Date().toISOString(), repository: repo, ref, issue: 482, agent: { model, provider: "z.ai coding" }, allowlist, checks: [] }
let failed = false
try {
  sandbox = await client.sandboxes.create({ template: "base", timeoutMs: 12 * 60_000 })
  await sandbox.connect()
  evidence.sandboxFingerprint = sha256(sandbox.sandboxId).slice(0, 16)
  const mkdir = await sandbox.commands.run("mkdir", { args: ["-p", "/workspace"] })
  if (mkdir.exitCode !== 0) throw new Error(`workspace mkdir failed: ${mkdir.stderr}`)
  await sandbox.git.clone(repo, { path: cwd })
  await sandbox.git.checkout(ref, { cwd })
  evidence.headSha = (await sandbox.git.log({ cwd, maxCount: 1 }))[0]?.hash
  if (evidence.headSha !== ref) throw new Error(`wrong checkout: ${evidence.headSha}`)

  evidence.checks.push(await must(sandbox, `curl -fsSL https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.xz -o /tmp/node.tar.xz && rm -rf /opt/node && mkdir -p /opt/node && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1 && /opt/node/bin/node --version && PATH=/opt/node/bin:$PATH /opt/node/bin/npm --version`, 3 * 60_000))
  evidence.checks.push(await must(sandbox, `${nodePath}npm install && git restore -- package-lock.json`, 8 * 60_000))
  const preAgentStatus = await sandbox.git.status(cwd)
  if (!preAgentStatus.clean) throw new Error(`install dirtied source tree: ${JSON.stringify(preAgentStatus)}`)
  await must(sandbox, `${nodePath}${vitePreviewHostEnv}nohup npm run start -- --host 0.0.0.0 --port ${port} --base / >/tmp/buddy-baseline.log 2>&1 </dev/null &`)
  const baselineCap = (await sandbox.previewUrl(port)).url
  try {
    await waitHttp(baselineCap)
  } catch (error) {
    evidence.baselineServerLog = scrub(await sandbox.files.readText("/tmp/buddy-baseline.log").catch(() => ""), 8000)
    throw error
  }
  evidence.baseline = await inspectAx(baselineCap, "baseline.png")
  if (evidence.baseline.unnamedButtonCount !== 4) throw new Error(`baseline drift: expected 4 unnamed buttons, got ${evidence.baseline.unnamedButtonCount}`)
  await run(sandbox, `pkill -f "vite.*${port}" || true`)

  await sandbox.env({ AGENT_API_KEY })
  await sandbox.files.write("/tmp/buddy-a11y-agent.mjs", agentSource)
  const agentRun = await must(sandbox, `${nodePath}node /tmp/buddy-a11y-agent.mjs`, 3 * 60_000)
  evidence.agent.result = agentRun.stdout.trim().slice(-4000)

  const status = await sandbox.git.status(cwd)
  const changed = [...new Set([...status.staged, ...status.modified, ...status.untracked])].sort()
  evidence.changedFiles = changed
  const forbidden = changed.filter((p) => !allowlist.includes(p))
  if (forbidden.length) throw new Error(`agent escaped allowlist: ${forbidden.join(", ")}`)
  if (!changed.length) throw new Error("agent made no changes")
  const diff = (await run(sandbox, "git diff --no-ext-diff --no-color --")).stdout
  evidence.diffSha256 = sha256(diff)

  for (const command of ["npm run typecheck", "npm run lint -- --max-warnings=0", "npm test -- --reporter=dot", "npm run build"]) evidence.checks.push(await must(sandbox, `${nodePath}${command}`, 8 * 60_000))
  await must(sandbox, `${nodePath}${vitePreviewHostEnv}nohup npm run preview -- --host 0.0.0.0 --port ${port} --base / >/tmp/buddy-final.log 2>&1 </dev/null &`)
  const finalCap = (await sandbox.previewUrl(port)).url
  try {
    await waitHttp(finalCap)
  } catch (error) {
    evidence.finalServerLog = scrub(await sandbox.files.readText("/tmp/buddy-final.log").catch(() => ""), 8000)
    throw error
  }
  evidence.previewUrl = publicUrl(finalCap)
  evidence.final = await inspectAx(finalCap, "final.png")
  if (evidence.final.unnamedButtonCount !== 0) throw new Error(`final a11y failed: ${evidence.final.unnamedButtonCount} unnamed buttons`)
  if (evidence.final.buttonCount !== evidence.baseline.buttonCount) throw new Error(`button-count regression: ${evidence.baseline.buttonCount} -> ${evidence.final.buttonCount}`)
  evidence.status = "PASSED"
} catch (error) {
  evidence.status = "FAILED"
  evidence.error = error instanceof Error ? error.message : String(error)
  failed = true
} finally {
  evidence.finishedAt = new Date().toISOString()
  if (sandbox) await sandbox.kill().catch(() => {})
  const running = []
  for await (const s of client.sandboxes.listAll({ state: "running" })) running.push(s.sandboxId)
  evidence.activeSandboxesAfterCleanup = running.length
  await writeFile(new URL("evidence.json", artifacts), JSON.stringify(evidence, null, 2) + "\n")
  console.log(JSON.stringify({ status: evidence.status, error: evidence.error, changedFiles: evidence.changedFiles, diffSha256: evidence.diffSha256, baseline: evidence.baseline, final: evidence.final, activeSandboxesAfterCleanup: evidence.activeSandboxesAfterCleanup }, null, 2))
  if (failed) process.exitCode = 1
}
