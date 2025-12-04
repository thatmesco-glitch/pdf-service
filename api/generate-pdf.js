const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

module.exports = async (req, res) => {
  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  // Alleen jouw domeinen toestaan
  const allowedDomains = [
    "testsiteofbene.webflow.io",
    "www.colomboandco.com",
  ];

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!allowedDomains.includes(targetUrl.hostname)) {
    return res.status(403).json({ error: "Domain not allowed" });
  }

  const safeFilename =
    (filename && filename.replace(/[^a-zA-Z0-9-_\.]/g, "_")) ||
    "download.pdf";

  // Sparticuz aanbevelingen
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  const chromeArgs = [
    ...chromium.args,
    "--font-render-hinting=none",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--disable-animations",
    "--disable-background-timer-throttling",
    "--disable-restore-session-state",
    "--disable-web-security",
    "--single-process",
  ];

  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromeArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Print-mode zodat je PDF netjes is
    await page.emulateMediaType("print");

    const response = await page.goto(targetUrl.toString(), {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    if (!response || !response.ok()) {
      throw new Error(
        `Failed to load page, status: ${response && response.status()}`
      );
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm",
      },
    });

    // Alle tabs sluiten om memory leaks te vermijden
    const pages = await browser.pages();
    await Promise.all(pages.map((p) => p.close()));

    await browser.close();
    browser = null;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);
    if (browser) {
      await browser.close();
    }
    return res.status(500).json({
      error: "PDF generation failed",
      details: String(err.message || err),
    });
  }
};
