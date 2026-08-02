/**
 * Run DepEd ECR parsing inside a Web Worker so the UI thread stays responsive.
 * Falls back to the main-thread parser if Workers are unavailable.
 */
export function parseEClassRecordInWorker(file, options = {}, onProgress) {
  return new Promise(async (resolve, reject) => {
    const buffer = await file.arrayBuffer();

    if (typeof Worker === "undefined") {
      const { parseEClassRecordBuffer } = await import(
        "@/lib/eclass/parseEClassCore"
      );
      try {
        resolve(parseEClassRecordBuffer(buffer, options, onProgress));
      } catch (error) {
        reject(error);
      }
      return;
    }

    let worker;
    try {
      worker = new Worker(
        new URL("./eclassParse.worker.js", import.meta.url)
      );
    } catch (error) {
      const { parseEClassRecordBuffer } = await import(
        "@/lib/eclass/parseEClassCore"
      );
      try {
        resolve(parseEClassRecordBuffer(buffer, options, onProgress));
      } catch (fallbackError) {
        reject(fallbackError);
      }
      return;
    }

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (event) => {
      const message = event.data ?? {};
      if (message.type === "progress") {
        onProgress?.({
          label: message.label,
          percent: message.percent,
        });
        return;
      }

      if (message.type === "result") {
        cleanup();
        resolve(message.payload);
      }
    };

    worker.onerror = (event) => {
      cleanup();
      reject(event?.error ?? new Error(event?.message || "E-Class worker failed."));
    };

    worker.postMessage(
      {
        type: "parse",
        buffer,
        options: {
          assignedClass: options.assignedClass
            ? {
                subject: options.assignedClass.subject,
                grade: options.assignedClass.grade,
                section: options.assignedClass.section,
                schoolYear: options.assignedClass.schoolYear,
                quarter: options.assignedClass.quarter,
                currentQuarter: options.assignedClass.currentQuarter,
                quarterLabel: options.assignedClass.quarterLabel,
                teacher: options.assignedClass.teacher,
                adviserDisplay: options.assignedClass.adviserDisplay,
                gradeLevel: options.assignedClass.gradeLevel,
              }
            : null,
          teacherName: options.teacherName ?? null,
          quarter: options.quarter ?? null,
          includeGrades: options.includeGrades !== false,
        },
      },
      [buffer]
    );
  });
}
