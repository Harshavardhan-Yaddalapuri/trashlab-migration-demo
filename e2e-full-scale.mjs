import { chromium } from "playwright";
import path from "node:path";

const SAMPLE_DIR = "/Users/harshavardhan/trashlab-demo/sample-data";
const BASE = "https://trashlab-migration-demo.vercel.app";

const files = [
  path.join(SAMPLE_DIR, "routepro_2019_export.csv"),
  path.join(SAMPLE_DIR, "quickbooks_customer_export.tsv"),
  path.join(SAMPLE_DIR, "transfer_station_weights.xlsx"),
  path.join(SAMPLE_DIR, "legacy_paper_export.tab"),
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("BROWSER CONSOLE ERROR:", msg.text());
});
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("requestfailed", (req) => console.log("REQUEST FAILED:", req.url(), req.failure()?.errorText));
page.on("response", (res) => {
  if (res.status() >= 400) console.log("HTTP", res.status(), res.url());
});

console.log("=== FULL 150k DATASET, ALL 4 REAL FILES ===");
await page.goto(`${BASE}/migrate`);
await page.waitForLoadState("networkidle");

console.log("1. Upload all 4 real, untruncated sample files (~13MB combined)");
const t0 = Date.now();
await page.locator('input[type="file"]').setInputFiles(files);
await page.waitForSelector("text=Files Received", { timeout: 30000 });
const total = await page.locator("text=Total Records").locator("..").innerText();
console.log("   Total shown:", total.replace(/\n/g, " "), `(${Date.now() - t0}ms to read+count)`);

console.log("2. Click Start Migration (this uploads to Blob storage)");
const t1 = Date.now();
await page.click("text=Start Migration");

// Wait for either the processing redirect (success) or the error message (still broken)
const result = await Promise.race([
  page.waitForURL(/\/migrate\/processing\?job=/, { timeout: 60000 }).then(() => "success"),
  page.waitForSelector("text=/Couldn't start the migration/", { timeout: 60000 }).then(() => "error"),
]);
console.log(`   Result: ${result} (${Date.now() - t1}ms)`);

if (result === "error") {
  await page.screenshot({ path: "/tmp/upload-error.png", fullPage: true });
  console.log("   FAILED — screenshot saved to /tmp/upload-error.png");
} else {
  const jobId = new URL(page.url()).searchParams.get("job");
  console.log("   jobId:", jobId);
  console.log("3. Wait for processing to complete (full 150k pipeline run)");
  const t2 = Date.now();
  await page.waitForURL(/\/workspace\?job=/, { timeout: 280000 });
  console.log(`   Landed at workspace after ${Date.now() - t2}ms`);
  await page.waitForTimeout(2000);
  const banner = await page.locator("text=/records moved clean/").innerText().catch(() => "MISSING");
  console.log("4. Outcome banner:", banner);
  await page.screenshot({ path: "/tmp/full-scale-workspace.png", fullPage: false });
}

await browser.close();
console.log("DONE");
