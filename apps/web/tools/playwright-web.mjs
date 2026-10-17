import { createServer } from "node:http";
import { spawn } from "node:child_process";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const production = process.env.PLAYWRIGHT_SERVER_MODE === "production";
const stub = createServer((request, response) => {
  const url = request.url || "";
  const authorization = request.headers.authorization || "";
  if (url.startsWith("/v1/auth/review-access") && authorization === "Bearer audio-reviewer-session") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, role: "content_reviewer" }));
    return;
  }
  if (url.startsWith("/v1/runtime/narration-approvals")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ narration_ids: [] }));
    return;
  }
  response.writeHead(401, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "reviewer session required" }));
});

await new Promise((resolve) => stub.listen(3999, "127.0.0.1", resolve));
const args = production
  ? ["next", "start", "--hostname", "127.0.0.1", "--port", port]
  : ["next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", port];
const child = spawn("npx", args, { stdio: "inherit", env: process.env });
const stop = () => {
  stub.close();
  child.kill("SIGTERM");
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => {
  stub.close();
  process.exit(code ?? 0);
});
