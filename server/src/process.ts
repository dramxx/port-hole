import { spawn, ChildProcess } from "child_process";
import { createWriteStream } from "fs";
import { EventEmitter } from "events";
import path from "path";
import { health } from "./opencode";

type ProcessStatus = "starting" | "running" | "restarting" | "fatal";

let currentStatus: ProcessStatus = "starting";
let childProcess: ChildProcess | null = null;
let consecutiveFailures = 0;
let stableTimer: NodeJS.Timeout | null = null;

export const processEvents = new EventEmitter();

const LOG_FILE = path.join(__dirname, "..", "..", "opencode.log");

export function getStatus(): ProcessStatus {
  return currentStatus;
}

async function checkHealth(): Promise<boolean> {
  try {
    const result = await health();
    console.log("Health check result:", result);
    return result.healthy === true;
  } catch (error) {
    console.log("Health check failed:", error.message);
    return false;
  }
}

async function waitForHealthy(
  maxAttempts: number,
  intervalMs: number,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkHealth()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

function resetFailureCounter() {
  consecutiveFailures = 0;
}

function startStableTimer() {
  if (stableTimer) {
    clearTimeout(stableTimer);
  }
  stableTimer = setTimeout(resetFailureCounter, 10 * 60 * 1000);
}

async function startOpenCode() {
  if (consecutiveFailures >= 5) {
    currentStatus = "fatal";
    processEvents.emit("fatal", "OpenCode failed to restart 5 times");
    return;
  }

  console.log("Checking if OpenCode is already running...");
  const isAlreadyRunning = await checkHealth();
  console.log("OpenCode already running:", isAlreadyRunning);

  if (isAlreadyRunning) {
    currentStatus = "running";
    processEvents.emit("ready");
    startStableTimer();
    return;
  }

  const logStream = createWriteStream(LOG_FILE, { flags: "a" });

  childProcess = spawn(
    "opencode",
    ["serve", "--hostname", "127.0.0.1", "--port", "4096"],
    { shell: true },
  );

  if (childProcess.stdout) {
    childProcess.stdout.pipe(logStream);
  }
  if (childProcess.stderr) {
    childProcess.stderr.pipe(logStream);
  }

  childProcess.on("exit", (code) => {
    logStream.end();

    if (code !== 0 && code !== null) {
      console.error(`OpenCode exited with code ${code}`);
      consecutiveFailures++;
      currentStatus = "restarting";

      setTimeout(() => {
        startOpenCode();
      }, 2000);
    }
  });

  const healthy = await waitForHealthy(15, 1000);

  if (healthy) {
    currentStatus = "running";
    processEvents.emit("ready");
    startStableTimer();
  } else {
    consecutiveFailures++;
    currentStatus = "starting";
    processEvents.emit("error", "OpenCode did not start within 15 seconds");

    if (childProcess) {
      childProcess.kill();
    }
  }
}

export async function initialize() {
  await startOpenCode();
}
