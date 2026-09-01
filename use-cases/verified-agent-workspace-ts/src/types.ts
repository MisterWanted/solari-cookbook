export interface RunConfig {
  repoUrl: string
  ref?: string
  installCommand: string
  testCommand: string
  agentCommand?: string
  startCommand: string
  port: number
  expectedText: string
  forwardEnvNames: string[]
}

export interface CommandEvidence {
  command: string
  exitCode: number
  stdout: string
  stderr: string
}

export interface GitStatusEvidence {
  branch: string
  detached: boolean
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  clean: boolean
}

export interface MutationEvidence {
  changedFiles: string[]
  diffSha256: string
}

export interface BrowserEvidence {
  expectedText: string
  title: string
  screenshotPath: string
  screenshotSha256: string
}

export interface EvidenceProgress {
  version: 1
  startedAt: string
  sandboxFingerprint?: string
  repository: string
  ref?: string
  headSha?: string
  gitStatus?: GitStatusEvidence
  previewUrl?: string
  commands: CommandEvidence[]
  browser?: BrowserEvidence
  mutation?: MutationEvidence
}

export interface PassedEvidence
  extends Omit<EvidenceProgress, "sandboxFingerprint" | "headSha" | "gitStatus" | "previewUrl" | "browser"> {
  status: "PASSED"
  finishedAt: string
  sandboxFingerprint: string
  headSha: string
  gitStatus: GitStatusEvidence
  previewUrl: string
  browser: BrowserEvidence
}

export interface FailedEvidence extends EvidenceProgress {
  status: "FAILED"
  finishedAt: string
  error: string
}

export type VerificationEvidence = PassedEvidence | FailedEvidence
