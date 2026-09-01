import { Solari } from "@solarisdk/browser"
import { mkdir } from "node:fs/promises"
import { dirname, relative } from "node:path"
import { sha256File } from "./evidence.js"
import type { BrowserEvidence } from "./types.js"


export async function verifyPreview(
  apiKey: string,
  url: string,
  expectedText: string,
  screenshotPath: string,
): Promise<BrowserEvidence> {
  const solari = new Solari({ apiKey })
  const browser = await solari.launch()
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: "networkidle" })
    const body = await page.locator("body").innerText()
    if (!body.includes(expectedText)) {
      throw new Error(`Expected text not found: ${expectedText}`)
    }

    await mkdir(dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath, fullPage: true })
    return {
      expectedText,
      title: await page.title(),
      screenshotPath: relative(process.cwd(), screenshotPath),
      screenshotSha256: await sha256File(screenshotPath),
    }
  } finally {
    await browser.close()
    await solari.close()
  }
}
