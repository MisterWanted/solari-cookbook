import { forwardedEnvironment, loadConfig } from "./src/config.js"
import { capabilityFingerprint, failEvidence, publicPreviewUrl, sha256Text, writeEvidence } from "./src/evidence.js"
import { verifyPreview } from "./src/solari-browser.js"
import { SolariWorkspaceProvider } from "./src/solari-workspace.js"
import type { EvidenceProgress, PassedEvidence } from "./src/types.js"
import { waitForHttp } from "./src/wait.js"

const apiKey = process.env.SOLARI_API_KEY
if (!apiKey) throw new Error("Missing SOLARI_API_KEY")

const config = loadConfig()
const evidencePath = "artifacts/evidence.json"
const screenshotPath = "artifacts/preview.png"
const workspace = new SolariWorkspaceProvider(apiKey)

const progress: EvidenceProgress = {
  version: 1,
  startedAt: new Date().toISOString(),
  repository: config.repoUrl,
  ref: config.ref,
  commands: [],
}

try {
  const sandboxFingerprint = capabilityFingerprint(await workspace.create())
  progress.sandboxFingerprint = sandboxFingerprint
  await workspace.clone(config.repoUrl, config.ref)
  await workspace.setEnvironment(forwardedEnvironment(config.forwardEnvNames))

  const headSha = await workspace.headSha()
  progress.headSha = headSha

  const commands = [config.installCommand, config.agentCommand, config.testCommand].filter(
    (command): command is string => Boolean(command),
  )
  for (const command of commands) {
    const result = await workspace.exec(command)
    progress.commands.push(result)
    if (result.exitCode !== 0) throw new Error(`Command failed (${result.exitCode}): ${command}`)
  }

  const gitStatus = await workspace.gitStatus()
  progress.gitStatus = gitStatus
  const diff = await workspace.gitDiff()
  if (diff) {
    progress.mutation = {
      changedFiles: [...new Set([...gitStatus.staged, ...gitStatus.modified, ...gitStatus.untracked])].sort(),
      diffSha256: sha256Text(diff),
    }
  }
  await workspace.start(config.startCommand)

  const previewCapabilityUrl = await workspace.previewUrl(config.port)
  const previewUrl = publicPreviewUrl(previewCapabilityUrl)
  progress.previewUrl = previewUrl
  await waitForHttp(previewCapabilityUrl)

  const browser = await verifyPreview(apiKey, previewCapabilityUrl, config.expectedText, screenshotPath)
  progress.browser = browser

  const evidence: PassedEvidence = {
    ...progress,
    status: "PASSED",
    finishedAt: new Date().toISOString(),
    sandboxFingerprint,
    headSha,
    gitStatus,
    previewUrl,
    browser,
  }
  await writeEvidence(evidencePath, evidence)
  console.log(JSON.stringify({
    status: evidence.status,
    headSha: evidence.headSha,
    previewUrl: evidence.previewUrl,
    screenshotSha256: evidence.browser.screenshotSha256,
  }, null, 2))
} catch (error) {
  await writeEvidence(evidencePath, failEvidence(progress, error))
  throw error
} finally {
  await workspace.destroy()
}
