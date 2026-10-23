const fs = require('fs');
const path = require('path');

const nextDir = path.resolve(process.cwd(), '.next');
const lockFile = path.resolve(nextDir, 'lock');
const traceFile = path.resolve(nextDir, 'trace');
const serverLock = path.resolve(nextDir, 'server', 'lock');

function isProcessRunning(pid) {
  if (!pid || typeof pid !== 'number' || isNaN(pid)) return false;
  try {
    // On Windows, kill(0) throws if process doesn't exist
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function tryReadPid(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return null;
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function checkLocks() {
  // Check common Next.js lock files
  const pids = [
    tryReadPid(lockFile),
    tryReadPid(serverLock),
    tryReadPid(traceFile),
  ].filter(Boolean);

  for (const pid of pids) {
    if (isProcessRunning(pid)) {
      throw new Error(`Next.js is currently running (PID ${pid}) using .next. Stop the dev server or build before cleaning.`);
    }
  }
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    // Try to be defensive
    throw new Error(`Failed to remove ${dir}: ${err.message}`);
  }
}

try {
  checkLocks();
  removeDir(nextDir);
  console.log('Cleaned .next directory safely.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
