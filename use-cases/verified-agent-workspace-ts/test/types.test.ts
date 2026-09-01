import type { VerificationEvidence } from "../src/types.js"

// A public PASS without complete proof must be impossible to construct.
// @ts-expect-error PASSED requires the full verified evidence shape.
const invalidPass: VerificationEvidence = {
  version: 1,
  startedAt: "2026-09-01T00:00:00.000Z",
  repository: "https://github.com/example/repo",
  commands: [],
  status: "PASSED",
}

void invalidPass
