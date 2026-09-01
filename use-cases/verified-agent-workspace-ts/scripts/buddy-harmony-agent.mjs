import { readFile, writeFile } from "node:fs/promises"

const key = process.env.AGENT_API_KEY
if (!key) throw new Error("Missing AGENT_API_KEY")
const model = "glm-5.3"
const allow = [
  "src/common/layout/Header.tsx",
  "src/common/layout/components/LanguageSelector.tsx",
  "src/common/toolbar/components/SettingsTools.tsx",
  "src/common/toolbar/Toolbar.tsx",
  "public/locales/en/common.json",
  "public/locales/nl/common.json",
  "public/locales/en/settings.json",
  "public/locales/nl/settings.json",
]
const files = {}
for (const path of allow) files[path] = await readFile(path, "utf8")
const prompt = [
  "Fix GitHub issue Marthijs-Berfelo/buddy-harmony#482 at exact current main.",
  "Runtime baseline on /scale proves exactly four unnamed buttons: menu/hamburger, language selector, settings gear, print.",
  "Key and Scale selectors already have accessible names: DO NOT modify those selectors.",
  "Keep blast radius minimal and only edit the allowlisted files.",
  "Accessible names must be localized through existing/new i18n keys.",
  "Match the repository's existing Prettier/ESLint formatting exactly; the final lint gate allows zero warnings.",
  "react-flags-select renders a button whose aria-labelledby points to itself and its Props do not accept aria-label; solve that without changing the library or visual layout.",
  "Return strict JSON only: {\"edits\":[{\"path\":\"...\",\"old\":\"exact unique substring\",\"new\":\"replacement\"}]}. Each old substring must occur exactly once. No markdown, no explanation.",
  "FILES:",
  ...Object.entries(files).map(([path, content]) => `--- ${path} ---\n${content}`),
].join("\n\n")
const res = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 12000,
    messages: [
      { role: "system", content: "You are a precise senior coding agent. Respect scope exactly. Output strict JSON only." },
      { role: "user", content: prompt },
    ],
  }),
})
if (!res.ok) throw new Error(`agent API HTTP ${res.status}`)
const payload = await res.json()
let text = payload?.choices?.[0]?.message?.content
if (typeof text !== "string") throw new Error("agent returned no content")
text = text.trim()
if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
const plan = JSON.parse(text)
if (!Array.isArray(plan.edits) || plan.edits.length < 1 || plan.edits.length > 20) throw new Error("invalid edit plan")
const changed = new Set()
for (const edit of plan.edits) {
  if (!allow.includes(edit.path) || typeof edit.old !== "string" || typeof edit.new !== "string" || !edit.old) throw new Error("invalid edit")
  let current = await readFile(edit.path, "utf8")
  const first = current.indexOf(edit.old)
  if (first < 0 || current.indexOf(edit.old, first + edit.old.length) >= 0) throw new Error(`non-unique old substring: ${edit.path}`)
  current = current.slice(0, first) + edit.new + current.slice(first + edit.old.length)
  await writeFile(edit.path, current, "utf8")
  changed.add(edit.path)
}
console.log(JSON.stringify({ model, changedFiles: [...changed].sort(), editCount: plan.edits.length }))
