const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".xlsx"];

export function validateEClassFile(file) {
  if (!file) {
    return { ok: false, error: "Please choose an Excel (.xlsx) file." };
  }

  const name = file.name?.toLowerCase?.() ?? "";
  const isXlsx =
    ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (!isXlsx) {
    return { ok: false, error: "Unsupported file type. Only .xlsx is accepted." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "File exceeds the 10 MB size limit." };
  }

  return { ok: true, error: null };
}

export { MAX_FILE_SIZE_BYTES, ACCEPTED_EXTENSIONS };
