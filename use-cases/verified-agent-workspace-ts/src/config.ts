import type { RunConfig } from "./types.js"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function envNames(value: string | undefined): string[] {
  if (!value) return []
  return [...new Set(value.split(",").map((name) => name.trim()).filter(Boolean))]
}

export function forwardedEnvironment(names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, required(name)]))
}

export function loadConfig(): RunConfig {
  const port = Number(process.env.PORT ?? "3000")
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`)
  }
  return {
    repoUrl: required("REPO_URL"),
    ref: process.env.REF || undefined,
    installCommand: process.env.INSTALL_CMD ?? "npm install",
    testCommand: process.env.TEST_CMD ?? "npm test",
    agentCommand: process.env.AGENT_CMD || undefined,
    startCommand: process.env.START_CMD ?? "npm run dev -- --host 0.0.0.0",
    port,
    expectedText: required("EXPECT_TEXT"),
    forwardEnvNames: envNames(process.env.FORWARD_ENV),
  }
}
