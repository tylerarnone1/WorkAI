import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const script = process.argv[2] ?? "dev";
const extraArgs = process.argv.slice(3);

if (script === "dev" || script === "start") {
  loadDotenv({ path: resolve(process.cwd(), ".env") });
}

// Avoid worker-based pino transport crashes in Next.js API route workers.
process.env["PINO_PRETTY_DISABLED"] = "true";

function configurePrismaEnginePath(): void {
  if (process.env["PRISMA_QUERY_ENGINE_LIBRARY"]) {
    return;
  }

  const prismaClientDir = resolve(process.cwd(), "node_modules/.prisma/client");
  if (!existsSync(prismaClientDir)) {
    return;
  }

  const engineFiles = readdirSync(prismaClientDir).filter((file) =>
    /^query_engine-.*\.(dll\.node|dylib\.node|so\.node)$/.test(file)
  );

  if (engineFiles.length === 0) {
    return;
  }

  const platformHint =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
      ? "darwin"
      : "linux";

  const selectedEngine =
    engineFiles.find((file) => file.includes(platformHint)) ?? engineFiles[0];

  process.env["PRISMA_QUERY_ENGINE_LIBRARY"] = resolve(
    prismaClientDir,
    selectedEngine
  );
}

configurePrismaEnginePath();

const args = ["--prefix", "src/ui", "run", script];
if (extraArgs.length > 0) {
  args.push("--", ...extraArgs);
}

const npmExecPath = process.env["npm_execpath"];
if (!npmExecPath) {
  console.error("npm_execpath is not set. Run this via an npm script.");
  process.exit(1);
}

const child = spawn(process.execPath, [npmExecPath, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to launch UI script:", error);
  process.exit(1);
});
