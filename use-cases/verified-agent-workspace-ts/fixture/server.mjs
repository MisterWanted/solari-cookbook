import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
const port = Number(process.env.PORT ?? 3000)
const html = await readFile(new URL("./index.html", import.meta.url), "utf8")
createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  res.end(html)
}).listen(port, "0.0.0.0", () => console.log(`fixture listening on ${port}`))
