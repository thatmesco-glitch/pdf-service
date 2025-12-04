const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

// Serverless function voor Vercel
module.exports = async (req, res) => {
  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  // Alleen deze domeinen toestaan
  const allowedDomains = [
    "testsiteofbene.webflow.io",
    "www.colomboandco.com"
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

  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    await page.goto(targetUrl.toString(), {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm"
      }
    });

    await browser.close();
    browser = null;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);
    if (browser) {
      await browser.close();
    }
    res
      .status(500)
      .json({ error: "PDF generation failed", details: err.message });
  }
};
