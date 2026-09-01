import assert from "node:assert/strict"
import test from "node:test"
import { forwardedEnvironment } from "../src/config.js"

test("forwards only explicitly named environment values", () => {
  process.env.TEST_AGENT_SECRET = "secret-value"
  try {
    assert.deepEqual(forwardedEnvironment(["TEST_AGENT_SECRET"]), {
      TEST_AGENT_SECRET: "secret-value",
    })
  } finally {
    delete process.env.TEST_AGENT_SECRET
  }
})

test("fails closed when an explicitly requested environment value is missing", () => {
  delete process.env.TEST_AGENT_SECRET_MISSING
  assert.throws(
    () => forwardedEnvironment(["TEST_AGENT_SECRET_MISSING"]),
    /Missing required environment variable/,
  )
})
