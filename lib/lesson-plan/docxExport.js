import JSZip from "jszip";
import {
  KAGAWARAN_HEADER_SEAL,
  DEPED_FOOTER_LOGO,
  BAGONG_PILIPINAS_FOOTER_LOGO,
  CNHS_FOOTER_LOGO,
} from "./docxLogos";

/**
 * Word Document (.docx) Generator & Exporter for DepEd Daily Lesson Plans
 * Directly loads and populates the master template: public/templates/LP_20week1.docx.
 * Preserves 100% of the original OpenXML layout, landscape geometry, typography, tables, and logos.
 */

function sanitizeToken(str = "") {
  return String(str || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_");
}

function escapeXml(unsafe = "") {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Standardized filename generator for both Principal and Teacher exports:
 * Format: LP_Week{X}_{Year}_{Subject}_{Section}.docx
 * Example: LP_Week1_2026-2027_English_Grade7.docx
 */
export function formatLessonPlanDownloadName(lesson = {}, { fallbackWeek = "1", fallbackYear = "2026-2027" } = {}) {
  const title = String(lesson?.lessonTitle || lesson?.title || "").trim();
  const sessions = String(lesson?.noOfSessions || "").trim();
  const fileName = String(lesson?.fileName || "").trim();
  const weekCovered = String(lesson?.weekCovered || lesson?.week_covered || "").trim();

  // Extract clean week number (avoid "WeekWeek")
  let weekNum = "";
  const rawWeek = lesson?.week || weekCovered || "";
  if (rawWeek) {
    const match = String(rawWeek).match(/\d+/);
    weekNum = match ? match[0] : String(rawWeek).replace(/^week\s*/i, "").trim();
  }
  if (!weekNum) {
    const weekMatch = (sessions || title || fileName).match(/week\s*(\d+)/i);
    weekNum = weekMatch ? weekMatch[1] : fallbackWeek;
  }

  // Extract clean school year
  let sy = lesson?.schoolYear || lesson?.school_year || lesson?.sy || null;
  if (!sy) {
    const yearMatch = (title || fileName).match(/(\d{4}(?:-\d{4})?)/);
    sy = yearMatch ? yearMatch[1] : fallbackYear;
  }
  const cleanSy = String(sy).replace(/^(SY\s*|S\.Y\.\s*)/i, "").trim();

  // Extract subject and section
  const subject = sanitizeToken(lesson?.subject || lesson?.learningArea || lesson?.learning_competency?.split("·")[0] || "");
  const section = sanitizeToken(lesson?.gradeSection || lesson?.section || "");

  const parts = ["LP", `Week${weekNum}`, cleanSy];
  if (subject) parts.push(subject);
  if (section) parts.push(section);

  return `${parts.join("_")}.docx`;
}

/**
 * Loads the master LP_20week1.docx template and programmatically populates the dynamic fields,
 * preserving 100% of the original OpenXML layout, styles, borders, and embedded logos.
 */
export async function generatePopulatedDocxBlob(lesson = {}) {
  let templateBuffer = null;

  if (typeof window !== "undefined") {
    const res = await fetch("/templates/LP_20week1.docx");
    if (!res.ok) throw new Error("Failed to load official lesson plan template.");
    templateBuffer = await res.arrayBuffer();
  } else {
    // Node.js / SSR environment
    const fs = await import("fs");
    const path = await import("path");
    const templatePath = path.join(process.cwd(), "public", "templates", "LP_20week1.docx");
    templateBuffer = fs.readFileSync(templatePath);
  }

  const zip = await JSZip.loadAsync(templateBuffer);
  let docXml = await zip.file("word/document.xml").async("string");

  // Dynamic values
  const lessonTitle = lesson?.lessonTitle || lesson?.title || lesson?.fileName || "DepEd Daily Lesson Plan";
  const learningArea = lesson?.learningArea || lesson?.subject || "English";
  const teacherName = lesson?.teacher || lesson?.teacherName || lesson?.author || "Roliza S. Antonio";
  const gradeSection = lesson?.gradeSection || lesson?.section || "Grade 7";
  const principalName = lesson?.principal || lesson?.principalName || lesson?.reviewedByName || "Dulce Vilma R. Galang";

  // 1. Target Lesson Title replacement
  const defaultTitleTarget = "Literature and My Father Goes to Court: Understanding Literature, Prose, Poetry, and Story Comprehension";
  if (docXml.includes(defaultTitleTarget)) {
    docXml = docXml.replace(defaultTitleTarget, escapeXml(lessonTitle));
  }

  // 2. Target Learning Area replacement
  if (docXml.includes("<w:t>English</w:t>")) {
    docXml = docXml.replace("<w:t>English</w:t>", `<w:t>${escapeXml(learningArea)}</w:t>`);
  }

  // 3. Target Teacher Name replacement in Metadata table
  if (docXml.includes("Roliza S. Antonio")) {
    docXml = docXml.replace("Roliza S. Antonio", escapeXml(teacherName));
  }

  // 4. Target Grade Level & Section replacement in Metadata table
  if (docXml.includes("<w:t>Grade 7</w:t>")) {
    docXml = docXml.replace("<w:t>Grade 7</w:t>", `<w:t>${escapeXml(gradeSection)}</w:t>`);
  }

  // 5. Target Signatory: Prepared by Teacher (Uppercase & Underlined)
  if (docXml.includes("ROLIZA S. ANTONIO")) {
    docXml = docXml.replace("ROLIZA S. ANTONIO", escapeXml(teacherName.toUpperCase()));
  }

  // 6. Target Signatory: Checked by Principal (Uppercase & Underlined)
  if (docXml.includes("DULCE VILMA R. GALANG")) {
    docXml = docXml.replace("DULCE VILMA R. GALANG", escapeXml(principalName.toUpperCase()));
  }

  // Update document.xml inside zip
  zip.file("word/document.xml", docXml);

  // Return genuine binary .docx blob
  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Directly downloads the official populated master DOCX file to the browser.
 */
export async function downloadLessonPlanDocx(lesson = {}, customFileName = null) {
  if (typeof window === "undefined") return;

  const blob = await generatePopulatedDocxBlob(lesson);
  const downloadName = customFileName || formatLessonPlanDownloadName(lesson);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName.endsWith(".docx") ? downloadName : `${downloadName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Direct file download from a remote/signed URL without opening a new or empty tab.
 */
export async function downloadFileFromUrl(url, fallbackFileName = "Lesson_Plan.docx") {
  if (typeof window === "undefined" || !url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fallbackFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (_err) {
    // Fallback: direct anchor trigger
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackFileName;
    a.target = "_self";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Strips internal review annotations and marks (<mark data-remark-id>) before exporting.
 */
export function stripHighlightMarks(html = "") {
  if (!html) return "";
  return String(html)
    .replace(/<mark\b[^>]*>(.*?)<\/mark>/gis, "$1")
    .replace(/<span\b[^>]*data-remark-id="[^"]*"[^>]*>(.*?)<\/span>/gis, "$1");
}

/**
 * Builds Word Document HTML string wrapping the actual lesson plan content (and edits)
 * inside the official DepEd CNHS Landscape layout and letterhead.
 */
export function buildWordDocumentHtml(contentHtml = "", metadata = {}) {
  const title = metadata.lessonTitle || metadata.title || metadata.fileName || "DepEd Daily Lesson Plan";
  const teacher = metadata.teacher || metadata.teacherName || metadata.author || "Subject Teacher";
  const principal = metadata.principal || metadata.principalName || metadata.reviewerName || "Dulce Vilma R. Galang";

  const cleanedContent = stripHighlightMarks(contentHtml);
  const lower = cleanedContent.toLowerCase();

  const hasHeader =
    lower.includes("republic of the philippines") ||
    lower.includes("cambaog national high school") ||
    lower.includes("schools division of bulacan");

  const hasSignatories =
    lower.includes("prepared by:") ||
    lower.includes("checked by:");

  const hasFooter =
    lower.includes("general alejo g. santos") ||
    lower.includes("300733@deped.gov.ph");

  const headerHtml = hasHeader
    ? ""
    : `<div style="text-align:center; margin-bottom:8pt;">
        <div style="margin-bottom:3pt;">
          <img src="${KAGAWARAN_HEADER_SEAL}" style="width:56px; height:56px; display:inline-block;" alt="Kagawaran ng Edukasyon Seal" />
        </div>
        <p style="margin:0; font-size:11.5pt; font-weight:bold; font-family:'Old English Text MT', 'Times New Roman', serif; color:#000000;">Republic of the Philippines</p>
        <p style="margin:0; font-size:15pt; font-weight:bold; font-family:'Old English Text MT', 'Times New Roman', serif; color:#000000;">Department of Education</p>
        <p style="margin:1pt 0 0 0; font-size:9.5pt; font-weight:bold; font-family:'Bookman Old Style', 'Calibri', sans-serif; text-transform:uppercase; color:#000000;">REGION III-CENTRAL LUZON</p>
        <p style="margin:1pt 0 0 0; font-size:9.5pt; font-weight:bold; font-family:'Trajan Pro', 'Bookman Old Style', 'Calibri', sans-serif; text-transform:uppercase; color:#000000;">SCHOOLS DIVISION OF BULACAN</p>
        <p style="margin:1pt 0 4pt 0; font-size:10.5pt; font-weight:bold; font-family:'Trajan Pro', 'Bookman Old Style', 'Calibri', sans-serif; text-transform:uppercase; color:#000000;">CAMBAOG NATIONAL HIGH SCHOOL</p>
        <div style="border-bottom:1.5pt solid #173d2d; margin-top:3pt; margin-bottom:8pt;"></div>
      </div>`;

  const signatoriesHtml = hasSignatories
    ? ""
    : `<table style="width:100%; margin-top:22pt; margin-bottom:14pt; border:none; border-collapse:collapse;">
        <tr style="border:none;">
          <td style="width:50%; border:none; padding:8pt 0; vertical-align:top;">
            <p style="margin:0 0 16pt 0; font-size:10pt; font-family:'Bookman Old Style', serif; color:#000000;">Prepared by:</p>
            <p style="margin:0 0 2pt 0; font-size:10.5pt; font-weight:bold; font-family:'Bookman Old Style', serif; text-transform:uppercase; text-decoration:underline; color:#000000;">${teacher.toUpperCase()}</p>
            <p style="margin:0; font-size:10pt; font-family:'Bookman Old Style', serif; color:#000000;">Subject Teacher</p>
          </td>
          <td style="width:50%; border:none; padding:8pt 0; vertical-align:top;">
            <p style="margin:0 0 16pt 0; font-size:10pt; font-family:'Bookman Old Style', serif; color:#000000;">Checked by:</p>
            <p style="margin:0 0 2pt 0; font-size:10.5pt; font-weight:bold; font-family:'Bookman Old Style', serif; text-transform:uppercase; text-decoration:underline; color:#000000;">${principal.toUpperCase()}</p>
            <p style="margin:0; font-size:10pt; font-family:'Bookman Old Style', serif; color:#000000;">School Principal</p>
          </td>
        </tr>
      </table>`;

  const footerHtml = hasFooter
    ? ""
    : `<div style="margin-top:18pt; border-top:1pt solid #cbd5e1; padding-top:6pt;">
        <table style="width:100%; border:none; border-collapse:collapse;">
          <tr style="border:none;">
            <td style="width:210px; border:none; padding:0; vertical-align:middle;">
              <table style="border:none; border-collapse:collapse;">
                <tr style="border:none;">
                  <td style="border:none; padding:0 6px 0 0; vertical-align:middle;">
                    <img src="${DEPED_FOOTER_LOGO}" style="height:32px; width:auto;" alt="DepEd" />
                  </td>
                  <td style="border:none; padding:0 6px 0 0; vertical-align:middle;">
                    <img src="${BAGONG_PILIPINAS_FOOTER_LOGO}" style="height:32px; width:auto;" alt="Bagong Pilipinas" />
                  </td>
                  <td style="border:none; padding:0; vertical-align:middle;">
                    <img src="${CNHS_FOOTER_LOGO}" style="height:32px; width:auto;" alt="CNHS" />
                  </td>
                </tr>
              </table>
            </td>
            <td style="border:none; padding:0 0 0 8pt; vertical-align:middle; font-size:8.5pt; color:#475569; font-family:'Calibri', 'Arial', sans-serif; line-height:1.3;">
              <p style="margin:0;">Address: General Alejo G. Santos High-way, Purok 3, Cambaog, Bustos, Bulacan</p>
              <p style="margin:0;">Email Address: <span style="text-decoration:underline; color:#0284c7;">300733@deped.gov.ph</span> &nbsp;|&nbsp; Contact Number: +63910-023-3159</p>
            </td>
          </tr>
        </table>
      </div>`;

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${title}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: 13.0in 8.5in;
    mso-page-orientation: landscape;
    margin: 0.4in 0.4in 0.4in 0.4in;
    mso-header-margin: 0.3in;
    mso-footer-margin: 0.3in;
    mso-paper-source: 0;
  }
  div.Section1 {
    page: Section1;
    font-family: 'Bookman Old Style', 'Calibri', 'Times New Roman', serif;
    font-size: 10pt;
    line-height: 1.25;
    color: #000000;
  }
  body {
    font-family: 'Bookman Old Style', 'Calibri', 'Times New Roman', serif;
    font-size: 10pt;
    line-height: 1.25;
    color: #000000;
  }
  h1 { font-size: 12.5pt; font-weight: bold; text-align: center; margin: 4pt 0; color: #000000; }
  h2 { font-size: 11pt; font-weight: bold; text-align: center; margin: 3pt 0; color: #000000; }
  h3 { font-size: 10pt; font-weight: bold; margin: 3pt 0; color: #000000; }
  p { margin: 2pt 0 3pt 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 4pt;
    margin-bottom: 8pt;
    border: 1pt solid #000000;
    table-layout: auto;
  }
  th, td {
    border: 1pt solid #000000;
    padding: 4pt 6pt;
    font-size: 9.5pt;
    vertical-align: top;
    color: #000000;
  }
  th {
    background-color: #f1f5f9;
    font-weight: bold;
    color: #000000;
  }
  tr:first-child td {
    font-weight: normal;
  }
  ul, ol {
    margin-top: 2pt;
    margin-bottom: 3pt;
    padding-left: 16pt;
  }
  li { margin-bottom: 1.5pt; }
</style>
</head>
<body>
<div class="Section1">
  ${headerHtml}
  ${cleanedContent}
  ${signatoriesHtml}
  ${footerHtml}
</div>
</body>
</html>`;
}

/**
 * Exports HTML to a Word document Blob.
 */
export function exportHtmlToWordBlob(contentHtml = "", metadata = {}) {
  const fullHtml = buildWordDocumentHtml(contentHtml, metadata);
  return new Blob(["\ufeff", fullHtml], {
    type: "application/msword;charset=utf-8",
  });
}

/**
 * Triggers a browser download of the edited HTML as a Word document (.doc).
 */
export function downloadHtmlAsWord(contentHtml = "", fileName = null, metadata = {}) {
  if (typeof window === "undefined") return;

  const blob = exportHtmlToWordBlob(contentHtml, metadata);
  const downloadName = fileName || formatLessonPlanDownloadName(metadata);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const finalName = downloadName.endsWith(".doc") || downloadName.endsWith(".docx") ? downloadName : `${downloadName}.doc`;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Creates a standard JavaScript File object containing a genuine binary .docx package
 * for uploading in-system edits to Supabase Storage.
 */
export async function createPopulatedDocxFile(lesson = {}, customFileName = null) {
  const blob = await generatePopulatedDocxBlob(lesson);
  const fileName = customFileName || formatLessonPlanDownloadName(lesson);
  const finalName = fileName.endsWith(".docx")
    ? fileName
    : `${fileName.replace(/\.[^/.]+$/, "")}.docx`;

  return new File([blob], finalName, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    lastModified: Date.now(),
  });
}

/**
 * Creates a standard JavaScript File object from the edited HTML to upload directly.
 */
export function createWordFileFromHtml(contentHtml = "", fileName = null, metadata = {}) {
  const blob = exportHtmlToWordBlob(contentHtml, metadata);
  const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : formatLessonPlanDownloadName(metadata).replace(/\.[^/.]+$/, "");
  const finalName = `${baseName}.docx`;

  return new File([blob], finalName, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    lastModified: Date.now(),
  });
}




