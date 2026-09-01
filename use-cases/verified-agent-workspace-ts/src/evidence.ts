import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { VerificationEvidence } from "./types.js"

const MAX_LOG_CHARS = 16_000

export function scrubOutput(value: string): string {
  const redacted = value
    .replace(/\bslr_live_[A-Za-z0-9_-]+\b/g, "[REDACTED_SOLARI_KEY]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]+\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]")
    .replace(/(Authorization:\s*Bearer\s+)\S+/gi, "$1[REDACTED]")
  if (redacted.length <= MAX_LOG_CHARS) return redacted
  return `${redacted.slice(0, MAX_LOG_CHARS)}\n...[truncated]`
}

export async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path)
  return createHash("sha256").update(bytes).digest("hex")
}

export async function writeEvidence(
  path: string,
  evidence: VerificationEvidence,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}
`, "utf8")
}

export function failEvidence(
  evidence: VerificationEvidence,
  error: unknown,
): VerificationEvidence {
  return {
    ...evidence,
    finishedAt: new Date().toISOString(),
    status: "FAILED",
    error: error instanceof Error ? error.message : String(error),
  }
}
