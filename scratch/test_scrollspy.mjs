import mammoth from "mammoth";
import fs from "fs";

async function run() {
  const res = await mammoth.convertToHtml({ path: "public/templates/LP_20week1.docx" });
  const html = res.value;

  const sections = [
    { key: "details", id: "lp-section-details", title: "Lesson Details", regex: /(<strong><em>Lesson Title<\/em><\/strong>|<p><strong>Lesson Title<\/strong><\/p>)/i },
    { key: "intentions", id: "lp-section-intentions", title: "I. Intentions & Objectives", regex: /(<p><strong>Intentions\.<\/strong><\/p>|<strong>Intentions<\/strong>|I\.\s*Intentions)/i },
    { key: "learner_context", id: "lp-section-learner-context", title: "II. Learner Context & Observations", regex: /(<p><em>Learner Context:\s*<\/em><\/p>|Learner Context:|II\.\s*Learner Context)/i },
    { key: "pre_lesson", id: "lp-section-pre-lesson", title: "III. Pre-Lesson Preparation", regex: /(<p><em>Pre-Lesson:\s*<\/em><\/p>|<p><strong>Learning Experience\.<\/strong><\/p>|Pre-Lesson:)/i },
    { key: "flow", id: "lp-section-flow", title: "IV. Learning Flow & Session Activities", regex: /(<p><em>Flow:\s*<\/em><\/p>|Flow:|IV\.\s*Learning Flow)/i },
    { key: "resources_integration", id: "lp-section-resources", title: "V. Learning Resources & Integration", regex: /(<p><em>Learning Resources:\s*<\/em><\/p>|Learning Resources:|V\.\s*Learning Resources)/i },
    { key: "assessment", id: "lp-section-assessment", title: "VI. Formative Assessment", regex: /(<p><strong>Assessment\.<\/strong><\/p>|<p><em>Formative Assessment:\s*<\/em><\/p>|Formative Assessment:)/i },
    { key: "ways_forward", id: "lp-section-ways-forward", title: "VII. Ways Forward & Reflections", regex: /(<p><strong>Ways Forward\.<\/strong><\/p>|Ways Forward\.|VII\.\s*Ways Forward)/i }
  ];

  let annotated = html;
  sections.forEach((s) => {
    annotated = annotated.replace(s.regex, (match) => {
      return `<span id="${s.id}" data-lp-section="${s.key}" class="scroll-mt-20 block"></span>${match}`;
    });
  });

  sections.forEach((s) => {
    console.log(s.id, "=> injected:", annotated.includes(`id="${s.id}"`));
  });
}

run();
