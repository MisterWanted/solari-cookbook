import { resolve } from "node:path"
import { loadConfig } from "./src/config.js"
import { failEvidence, writeEvidence } from "./src/evidence.js"
import { verifyPreview } from "./src/solari-browser.js"
import { SolariWorkspaceProvider } from "./src/solari-workspace.js"
import type { VerificationEvidence } from "./src/types.js"
import { waitForHttp } from "./src/wait.js"

const apiKey = process.env.SOLARI_API_KEY
if (!apiKey) throw new Error("Missing SOLARI_API_KEY")

const config = loadConfig()
const evidencePath = resolve("artifacts/evidence.json")
const screenshotPath = resolve("artifacts/preview.png")
const workspace = new SolariWorkspaceProvider(apiKey)

let evidence: VerificationEvidence = {
  version: 1,
  startedAt: new Date().toISOString(),
  repository: config.repoUrl,
  ref: config.ref,
  commands: [],
  status: "RUNNING",
}

try {
  evidence.sandboxId = await workspace.create()
  await workspace.clone(config.repoUrl, config.ref)
  evidence.headSha = await workspace.headSha()

  const commands = [config.installCommand, config.agentCommand, config.testCommand].filter(
    (command): command is string => Boolean(command),
  )
  for (const command of commands) {
    const result = await workspace.exec(command)
    evidence.commands.push(result)
    if (result.exitCode !== 0) {
      throw new Error(`Command failed (${result.exitCode}): ${command}`)
    }
  }
  evidence.gitStatus = await workspace.gitStatus()

  await workspace.start(config.startCommand)
  evidence.previewUrl = await workspace.previewUrl(config.port)
  await waitForHttp(evidence.previewUrl)
  evidence.browser = await verifyPreview(
    apiKey,
    evidence.previewUrl,
    config.expectedText,
    screenshotPath,
  )
  evidence = {
    ...evidence,
    finishedAt: new Date().toISOString(),
    status: "PASSED",
  }
  await writeEvidence(evidencePath, evidence)
  console.log(JSON.stringify(evidence, null, 2))
} catch (error) {
  evidence = failEvidence(evidence, error)
  await writeEvidence(evidencePath, evidence)
  throw error
} finally {
  await workspace.destroy()
}
