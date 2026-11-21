import { chromium } from "playwright";
import chromiumBinary from "@sparticuz/chromium";

export async function generateRecapImage(
  html: string
): Promise<Buffer> {
  const browser = await chromium.launch({
    args: chromiumBinary.args,
    executablePath: await chromiumBinary.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: "load",
    });

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await page.waitForFunction(
  () =>
    (window as Window & {
      recapReady?: boolean;
    }).recapReady === true,
  undefined,
  { timeout: 30000 }
);

    const image = await page.screenshot({
      type: "png",
      fullPage: true,
    });

    return Buffer.from(image);
  } finally {
    await browser.close();
  }
}