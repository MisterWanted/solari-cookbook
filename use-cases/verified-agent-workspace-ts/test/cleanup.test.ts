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
      run: async (_command: string, options: { args?: string[] }) => {
        if (options.args?.[1]?.includes("nohup")) { events.push(`run-detached:${options.args[1].includes("setsid")}`); return { exitCode: 0, stdout: "1234\n", stderr: "" } }
        events.push("run-stop")
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    },
    kill: async () => { events.push("sandbox-kill") },
  }
  const provider = new SolariWorkspaceProvider("test-key")
  Object.defineProperty(provider, "sandbox", { value: sandbox, writable: true })
  await provider.start("npm run dev -- --host 0.0.0.0")
  await provider.destroy()
  assert.deepEqual(events, [
    "write:/tmp/verified-agent-preview.sh:true",
    "run-detached:true",
    "run-stop",
    "sandbox-kill",
  ])
})

test("cleanup verification ignores other concurrent sandboxes", async () => {
  const provider = new SolariWorkspaceProvider("test-key")
  const sandbox = { sandboxId: "owned", kill: async () => {}, commands: { run: async () => ({ exitCode: 0, stdout: "", stderr: "" }) } }
  Object.defineProperty(provider, "sandbox", { value: sandbox, writable: true })
  Object.defineProperty(provider, "ownedSandboxId", { value: "owned", writable: true })
  Object.defineProperty(provider, "client", { value: { sandboxes: { listAll: async function* () { yield { sandboxId: "someone-else" } } } } })
  await provider.destroy()
  assert.equal(await provider.ownedSandboxCount(), 0)
})

test("failed create kills only the sandbox created by this provider", async () => {
  const killed: string[] = []
  const owned = { sandboxId: "owned", connect: async () => { throw new Error("connect failed") } }
  const provider = new SolariWorkspaceProvider("test-key")
  Object.defineProperty(provider, "client", { value: { sandboxes: {
    create: async () => owned,
    kill: async (id: string) => { killed.push(id) },
    listAll: async function* () { yield { sandboxId: "someone-else" } },
  } } })
  await assert.rejects(() => provider.create(), /connect failed/)
  assert.deepEqual(killed, ["owned"])
})

test("cleanup detects an owned sandbox in any remaining state", async () => {
  let filter: unknown = "unset"
  const provider = new SolariWorkspaceProvider("test-key")
  Object.defineProperty(provider, "ownedSandboxId", { value: "owned", writable: true })
  Object.defineProperty(provider, "client", { value: { sandboxes: { listAll: async function* (options?: unknown) { filter = options; yield { sandboxId: "owned", state: "paused" } } } } })
  assert.equal(await provider.ownedSandboxCount(), 1)
  assert.equal(filter, undefined)
})
