/**
 * Cross-platform script to ensure a specified port (default: 3002) is free before starting Next.js.
 * Automatically terminates lingering processes to prevent EADDRINUSE errors.
 */

const { execSync } = require("child_process");

const targetPort = process.argv[2] || "3002";
const isWin = process.platform === "win32";

function freePort(port) {
  try {
    if (isWin) {
      // Find PID listening on port
      const cmd = `netstat -ano | findstr :${port}`;
      let output = "";
      try {
        output = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      } catch {
        // No process found on this port
        return;
      }

      const lines = output.trim().split("\n");
      const pids = new Set();

      for (const line of lines) {
        if (!line.includes("LISTENING") && !line.includes(`:${port}`)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(`[ensure-port] Successfully cleared process ${pid} occupying port ${port}`);
        } catch {
          // Process may have already exited
        }
      }
    } else {
      // Unix / macOS
      try {
        execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: "ignore" });
        console.log(`[ensure-port] Successfully cleared process occupying port ${port}`);
      } catch {
        // No process found
      }
    }
  } catch (err) {
    // Non-fatal warning
  }
}

freePort(targetPort);
console.log(`[ensure-port] Port ${targetPort} is ready for Next.js.`);
