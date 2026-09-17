/**
 * Cross-platform launcher for ml-service uvicorn.
 * Prefers ml-service/.venv (Windows Scripts / Unix bin).
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "ml-service");
const isWin = process.platform === "win32";
const venvUvicorn = path.join(
  root,
  ".venv",
  isWin ? "Scripts" : "bin",
  isWin ? "uvicorn.exe" : "uvicorn"
);

const port = process.env.PORT || "8000";
const args = ["app.main:app", "--host", "0.0.0.0", "--port", String(port)];

let command;
let commandArgs;

if (fs.existsSync(venvUvicorn)) {
  command = venvUvicorn;
  commandArgs = args;
} else {
  console.warn(
    "[ml-serve] ml-service/.venv not found — using system `python -m uvicorn`.\n" +
      "  cd ml-service && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt"
  );
  command = isWin ? "py" : "python3";
  commandArgs = ["-m", "uvicorn", ...args];
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
