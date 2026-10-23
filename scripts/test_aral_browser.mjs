import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, basename, sep } from "node:path";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const bundledWebpack = require("next/dist/compiled/webpack/webpack");
bundledWebpack.init();
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = resolve(import.meta.dirname, "..");
const out = await mkdtemp(join(tmpdir(), "cnhs-aral-ui-"));
const mocks = resolve(root, "scripts/test-support/aral-browser-mocks.jsx");
const aliases = Object.fromEntries([
  "next/link", "next/navigation", "@/hooks/teacher/useMonitoring", "@/lib/supabase/queries/monitoring", "@/lib/supabase/client",
  "@/components/shared/AppToast", "@/components/layout/MobileNavSheet", "@/components/teacher/layout/TeacherSidebar",
  "@/components/shared/PageHelp", "@/components/aral/ExportAralReportModal", "@/lib/reports/aralRecommendedExport",
  "@/lib/reports/aralWeeklyProgressExport",
].map((name) => [`${name}$`, mocks]));
let browser;
let server;
try {
  await new Promise((done, reject) => webpack({ mode: "development", context: root, target: "web",
    entry: "./scripts/test-support/aral-browser-entry.jsx", devtool: false,
    output: { path: out, filename: "bundle.js" },
    resolve: { extensions: [".js", ".jsx", ".mjs"], alias: { ...aliases, "@": root } },
    module: { rules: [{ test: /\.[cm]?jsx?$/, exclude: /node_modules/, use: resolve(root, "scripts/test-support/aral-browser-loader.cjs") }] },
    plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : done()));
  const bundle = await readFile(join(out, "bundle.js"));
  server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>'); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", (error) => { failures.push(error.message); console.error("Browser:", error.message); });
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base);
  await expect(page.getByRole("tab", { name: "BOSY", exact: true })).toHaveAttribute("aria-selected", "true");
  const gst = page.getByRole("spinbutton", { name: "GST score for Ana Cruz" });
  await gst.fill("18");
  await expect(page.getByRole("button", { name: "Save screening first" })).toBeDisabled();
  await page.getByRole("tab", { name: "MOSY", exact: true }).click();
  await expect(gst).toHaveValue("");
  await gst.fill("22");
  await page.getByRole("button", { name: "Save All Results", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Successfully saved GST");
  await page.getByRole("tab", { name: "BOSY", exact: true }).click();
  await expect(gst).toHaveValue("18");
  await page.getByRole("button", { name: "Save All Results", exact: true }).click();
  await expect(page.getByRole("button", { name: "Individual Assessment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Individual Assessment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Individual Reading Assessment" });
  await dialog.getByRole("spinbutton", { name: "Total Words", exact: true }).fill("100");
  await dialog.getByRole("spinbutton", { name: "Miscues / Errors" }).fill("8");
  await dialog.getByRole("spinbutton", { name: "Reading minutes" }).fill("1");
  await dialog.getByRole("spinbutton", { name: "Reading seconds" }).fill("30");
  await dialog.getByRole("spinbutton", { name: "Comprehension correct" }).fill("6");
  await dialog.getByRole("button", { name: "Save Assessment Result" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review Assessment", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "MOSY", exact: true }).click();
  await expect(gst).toHaveValue("22");
  await page.getByRole("tab", { name: "EOSY", exact: true }).click();
  await gst.fill("24");
  await page.getByRole("button", { name: "Save All Results", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Successfully saved GST");
  await page.getByRole("tab", { name: "BOSY", exact: true }).click();
  await gst.fill("20");
  await page.getByRole("button", { name: "Save All Results", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("explain the correction");
  await page.getByPlaceholder("Explain the correction", { exact: true }).fill("Corrected transcription");
  await page.getByRole("button", { name: "Save All Results", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Successfully saved GST");
  await page.getByRole("tab", { name: "MOSY", exact: true }).click();
  await expect(gst).toHaveValue("22");
  await page.getByRole("tab", { name: "EOSY", exact: true }).click();
  await expect(gst).toHaveValue("24");
  const records = await page.evaluate(() => window.__aralTest.rows);
  expect(records).toHaveLength(3);
  expect(records.find((row) => row.assessment_period === "BOSY").raw_payload.auditTrail.at(-1).reason).toBe("Corrected transcription");
  await page.goto(`${base}/principal`);
  for (const period of ["BOSY", "MOSY", "EOSY"]) {
    await page.getByRole("tab", { name: period, exact: true }).click();
    await expect(page.getByRole("tab", { name: period, exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /Learner Records/ }).click();
    await expect(page.getByRole("row", { name: /CRUZ, Ana/ })).toBeVisible();
    await page.getByRole("button", { name: "View Record", exact: true }).click();
    const expected = { BOSY: 20, MOSY: 22, EOSY: 24 }[period];
    await expect(page.getByText(`${expected} / 40 (Below Benchmark)`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).first().click();
  }
  expect(await page.locator('button:has-text("Activate")').count()).toBe(0);
  expect(failures).toEqual([]);
  console.log("PASS: teacher GST encoding, local drafts, period switching, Form 3, corrections, independent saves and Principal oversight (Chrome).");
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((done) => server.close(done));
  if (!resolve(out).startsWith(resolve(tmpdir()) + sep) || !basename(out).startsWith("cnhs-aral-ui-")) throw new Error("Unexpected test output directory");
  await rm(out, { recursive: true, force: true });
}
