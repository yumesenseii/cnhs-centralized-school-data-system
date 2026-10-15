const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".xlsx"];

export function validateEClassFile(file) {
  if (!file) {
    return { ok: false, error: "Paki-pili ang opisyal na DepEd Excel (.xlsx) file." };
  }

  const name = file.name?.toLowerCase?.() ?? "";
  const isXlsx =
    ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (!isXlsx) {
    return {
      ok: false,
      error: "Hindi tinatanggap ang file format na ito. Paki-upload po ang opisyal na DepEd Excel file (.xlsx).",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: "Masyadong malaki ang napiling file (lagpas sa 10 MB limit). Karaniwang mas maliit sa 5 MB ang opisyal na E-Class Record.",
    };
  }

  return { ok: true, error: null };
}

export { MAX_FILE_SIZE_BYTES, ACCEPTED_EXTENSIONS };
