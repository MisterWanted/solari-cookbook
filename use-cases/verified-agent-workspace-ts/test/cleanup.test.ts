import assert from "node:assert/strict"
import test from "node:test"
import { SolariWorkspaceProvider } from "../src/solari-workspace.js"

test("starts preview detached without leaving a pending command handle", async () => {
  const events: string[] = []
  const sandbox = {
    files: {
      write: async (path: string, body: string) => {
        events.push(`write:${path}:${body.includes("npm run dev")}`)
      },
    },
    commands: {
      start: async () => { throw new Error("commands.start must not be used") },
      run: async () => {
        events.push("run-detached")
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    },
    kill: async () => { events.push("sandbox-kill") },
  }
  const provider = new SolariWorkspaceProvider("test-key")
  ;(provider as unknown as { sandbox: typeof sandbox }).sandbox = sandbox
  await provider.start("npm run dev -- --host 0.0.0.0")
  await provider.destroy()
  assert.deepEqual(events, [
    "write:/tmp/verified-agent-preview.sh:true",
    "run-detached",
    "sandbox-kill",
  ])
})
