import { SolariClient } from "@solarisdk/sdk"
import type { CommandEvidence } from "./types.js"
import { scrubOutput } from "./evidence.js"

type SandboxHandle = Awaited<ReturnType<SolariClient["sandboxes"]["create"]>>

export class SolariWorkspaceProvider {
  private readonly client: SolariClient
  private sandbox: SandboxHandle | null = null

  constructor(apiKey: string) {
    this.client = new SolariClient({ apiKey })
  }

  async create(): Promise<string> {
    this.sandbox = await this.client.sandboxes.create({
      template: "base",
      timeoutMs: 10 * 60_000,
    })
    await this.sandbox.connect()
    const mkdir = await this.sandbox.commands.run("mkdir", { args: ["-p", "/workspace"] })
    if (mkdir.exitCode !== 0) throw new Error(`Failed to prepare workspace: ${mkdir.stderr}`)
    return this.sandbox.sandboxId
  }

  async clone(repoUrl: string, ref?: string): Promise<void> {
    const sandbox = this.requireSandbox()
    await sandbox.git.clone(repoUrl, { path: "/workspace/repo" })
    if (ref) await sandbox.git.checkout(ref, { cwd: "/workspace/repo" })
  }

  async exec(command: string): Promise<CommandEvidence> {
    const sandbox = this.requireSandbox()
    const result = await sandbox.commands.run("sh", {
      args: ["-lc", command],
      cwd: "/workspace/repo",
      timeoutMs: 8 * 60_000,
    })
    return {
      command: scrubOutput(command),
      exitCode: result.exitCode,
      stdout: scrubOutput(result.stdout),
      stderr: scrubOutput(result.stderr),
    }
  }

  async start(command: string): Promise<void> {
    const sandbox = this.requireSandbox()
    await sandbox.files.write(
      "/tmp/verified-agent-preview.sh",
      `#!/bin/sh\nset -eu\ncd /workspace/repo\n${command}\n`,
    )
    const result = await sandbox.commands.run("sh", {
      args: [
        "-lc",
        "nohup sh /tmp/verified-agent-preview.sh >/tmp/verified-agent-preview.log 2>&1 </dev/null &",
      ],
    })
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start preview: ${scrubOutput(result.stderr)}`)
    }
  }

  async gitStatus() {
    return this.requireSandbox().git.status("/workspace/repo")
  }

  async headSha(): Promise<string> {
    const [commit] = await this.requireSandbox().git.log({
      cwd: "/workspace/repo",
      maxCount: 1,
    })
    if (!commit) throw new Error("Repository has no HEAD commit")
    return commit.hash
  }

  async previewUrl(port: number): Promise<string> {
    return (await this.requireSandbox().previewUrl(port)).url
  }

  async destroy(): Promise<void> {
    if (this.sandbox) {
      await this.sandbox.kill()
      this.sandbox = null
    }
  }

  private requireSandbox(): SandboxHandle {
    if (!this.sandbox) throw new Error("Workspace has not been created")
    return this.sandbox
  }
}
