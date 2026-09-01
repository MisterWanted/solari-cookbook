import { readFile } from "node:fs/promises"
const html = await readFile(new URL("./index.html", import.meta.url), "utf8")
if (!html.includes("Solari verification passed")) throw new Error("expected proof text missing")
console.log("fixture test passed")
