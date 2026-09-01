import assert from "node:assert/strict"
import test from "node:test"
import * as evidenceModule from "../src/evidence.js"

test("removes signed capability query data from public preview evidence", () => {
  const sanitize = (evidenceModule as Record<string, unknown>).publicPreviewUrl
  assert.equal(typeof sanitize, "function")
  const result = (sanitize as (value: string) => string)(
    "https://demo.preview.getsolari.com/path?pt_token=super-secret&other=1",
  )
  assert.equal(result, "https://demo.preview.getsolari.com/path")
})

test("fingerprints opaque sandbox capabilities instead of exposing them", () => {
  const fingerprint = (evidenceModule as Record<string, unknown>).capabilityFingerprint
  assert.equal(typeof fingerprint, "function")
  const value = (fingerprint as (value: string) => string)("signed-sandbox-capability")
  assert.match(value, /^[a-f0-9]{16}$/)
  assert.notEqual(value, "signed-sandbox-capability")
})
