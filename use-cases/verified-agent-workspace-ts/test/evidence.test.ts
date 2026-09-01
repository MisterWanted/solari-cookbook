import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { sha256File, writeEvidence } from "../src/evidence.js"
import type { VerificationEvidence } from "../src/types.js"

test("hashes and writes durable evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "solari-evidence-"))
  const artifact = join(dir, "preview.png")
  await writeFile(artifact, "proof")
  assert.equal(
    await sha256File(artifact),
    "c1cda26362828b69266512052b97cb3729e3b052e4ade47c0a1e3383defe73c7",
  )

  const evidence: VerificationEvidence = {
    version: 1,
    startedAt: "2026-09-01T00:00:00.000Z",
    repository: "https://github.com/example/repo",
    commands: [],
    status: "PASSED",
  }
  const out = join(dir, "evidence.json")
  await writeEvidence(out, evidence)
  assert.deepEqual(JSON.parse(await readFile(out, "utf8")), evidence)
})
