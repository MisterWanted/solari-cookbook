export interface RunConfig {
  repoUrl: string
  ref?: string
  installCommand: string
  testCommand: string
  agentCommand?: string
  startCommand: string
  port: number
  expectedText: string
}

export interface CommandEvidence {
  command: string
  exitCode: number
  stdout: string
  stderr: string
}

export interface VerificationEvidence {
  version: 1
  startedAt: string
  finishedAt?: string
  sandboxFingerprint?: string
  repository: string
  ref?: string
  headSha?: string
  gitStatus?: {
    branch: string
    detached: boolean
    ahead: number
    behind: number
    staged: string[]
    modified: string[]
    untracked: string[]
    clean: boolean
  }
  previewUrl?: string
  commands: CommandEvidence[]
  browser?: {
    expectedText: string
    title: string
    screenshotPath: string
    screenshotSha256: string
  }
  status: "RUNNING" | "PASSED" | "FAILED"
  error?: string
}
