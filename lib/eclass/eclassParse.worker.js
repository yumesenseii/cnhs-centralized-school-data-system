import { parseEClassRecordBuffer } from "@/lib/eclass/parseEClassCore";

self.onmessage = (event) => {
  const message = event.data ?? {};
  if (message.type !== "parse") return;

  try {
    const result = parseEClassRecordBuffer(
      message.buffer,
      message.options ?? {},
      (progress) => {
        self.postMessage({ type: "progress", ...progress });
      }
    );

    self.postMessage({
      type: "result",
      payload: {
        ok: result.ok,
        metadata: result.metadata,
        learners: result.learners,
        grades: result.grades,
        sheetName: result.sheetName,
        worksheetNames: result.worksheetNames,
        gradesAttached: result.gradesAttached,
        gradeCounts: result.gradeCounts,
        validation: result.validation,
        timings: result.timings,
        error: result.error,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "result",
      payload: {
        ok: false,
        metadata: null,
        learners: [],
        grades: [],
        error: error?.message ?? "Failed to parse E-Class Record.",
      },
    });
  }
};
