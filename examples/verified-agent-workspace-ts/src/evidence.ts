import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { VerificationEvidence } from "./types.js"

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
