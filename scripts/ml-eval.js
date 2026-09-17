/**
 * Cross-platform launcher for ml-service eval_confusion_matrix.py
 * Prefers ml-service/.venv (Windows Scripts / Unix bin).
 *
 * Evaluates academic RISK only — not ARAL, not Classroom Remedial.
 * Not used by the teacher app.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "ml-service");
const isWin = process.platform === "win32";
const venvPython = path.join(
  root,
  ".venv",
  isWin ? "Scripts" : "bin",
  isWin ? "python.exe" : "python"
);
const script = path.join("scripts", "eval_confusion_matrix.py");
const extraArgs = process.argv.slice(2);

let command;
let commandArgs;

if (fs.existsSync(venvPython)) {
  command = venvPython;
  commandArgs = [script, ...extraArgs];
} else {
  console.warn(
    "[ml-eval] ml-service/.venv not found — using system Python.\n" +
      "  cd ml-service && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt"
  );
  command = isWin ? "py" : "python3";
  commandArgs = [script, ...extraArgs];
}

const child = spawn(command, commandArgs, {
  cwd: root,
  stdio: "inherit",
  shell: isWin && command === "py",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
