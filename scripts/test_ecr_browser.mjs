import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, basename, sep } from "node:path";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
const require = createRequire(import.meta.url);
require("next/dist/compiled/webpack/webpack").init();
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = resolve(import.meta.dirname, "..");
const out = await mkdtemp(join(tmpdir(), "cnhs-ecr-ui-"));
const mocks = resolve(root, "scripts/test-support/ecr-browser-mocks.jsx");
const fixture = resolve(root, "scripts/test-support/ecr-fixture.mjs");
const aliases = Object.fromEntries([
  "next/link", "@/components/shared/AppToast", "@/components/layout/MobileNavSheet", "@/components/teacher/layout/TeacherSidebar",
  "@/components/teacher/my-classes/EClassUploadDialog", "@/lib/reports/excelOfficialTemplate",
].map((name) => [`${name}$`, mocks]));
let browser, server;
try {
  await new Promise((done, reject) => webpack({ mode: "development", context: root, target: "web",
    entry: "./scripts/test-support/ecr-browser-entry.jsx", devtool: false, output: { path: out, filename: "bundle.js" },
    resolve: { extensions: [".js", ".jsx", ".mjs"], alias: { ...aliases, "@/lib/supabase/client$": fixture, "@/lib/supabase/queries/myClasses$": fixture, "@": root } },
    module: { rules: [{ test: /\.[cm]?jsx?$/, exclude: /node_modules/, use: resolve(root, "scripts/test-support/aral-browser-loader.cjs") }] },
    plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : done()));
  const bundle = await readFile(join(out, "bundle.js"));
  const template = await readFile(join(root, "public/templates/official-ecr-template.xlsx"));
  server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
    else if (request.url === "/templates/official-ecr-template.xlsx") response.end(template);
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>'); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", (error) => { failures.push(error.message); console.error("Browser:", error.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const score = page.getByRole("spinbutton", { name: "student-1 WW:1", exact: true });
  await expect(score).toHaveValue("");
  await expect(page.getByText("0/41 with assessment scores", { exact: true })).toBeVisible();
  await expect(page.getByText("40/41 with term grades", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__ecrTest.fixture.calls.filter((call) => call.operation !== "select").length)).toBe(0);
  await score.fill("20");
  await page.getByRole("button", { name: "Term 2", exact: true }).click();
  await expect(score).toHaveValue("");
  await score.fill("18");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved.");
  await page.getByRole("button", { name: "Term 1", exact: true }).click();
  await expect(score).toHaveValue("20");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__ecrTest.remount());
  await expect(score).toHaveValue("20");
  await page.getByRole("button", { name: "Term 2", exact: true }).click();
  await expect(score).toHaveValue("18");
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Official E-Class Record downloaded.");
  expect(await page.evaluate(() => window.__ecrExport)).toMatchObject({ term1: 85, term2: 88, items: 2 });
  await page.getByRole("button", { name: "Publish Grades", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("incomplete");
  const snapshot = await page.evaluate(() => {
    const tables = window.__ecrTest.fixture.tables;
    return { official: tables.grades.length, statuses: tables.ecr_term_sheets.map((row) => row.status) };
  });
  expect(snapshot.official).toBe(80); expect(snapshot.statuses.every((value) => value === "draft")).toBe(true);
  await page.evaluate(() => { window.__ecrTest.fixture.tables.ecr_term_sheets.find((row) => row.id === "book-2-term-2").status = "published"; window.__ecrTest.remount(); });
  await page.getByRole("button", { name: "Term 2", exact: true }).click();
  await expect(score).toBeDisabled();
  expect(failures).toEqual([]);
  console.log("PASS: teacher final-only display, correct counters, independent Term 1/2 encoding, save, remount/reload, publication checks, published protection, authentic Excel export (Chrome; isolated records).");
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((done) => server.close(done));
  if (!resolve(out).startsWith(resolve(tmpdir()) + sep) || !basename(out).startsWith("cnhs-ecr-ui-")) throw new Error("Unexpected test output directory");
  await rm(out, { recursive: true, force: true });
}
