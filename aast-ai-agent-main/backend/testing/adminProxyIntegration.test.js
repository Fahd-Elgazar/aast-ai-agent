import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";

const AUTH_SECRET = "iteration-7-admin-proxy-secret-with-more-than-32-bytes";
process.env.AUTH_JWT_SECRET = AUTH_SECRET;
process.env.AUTH_TOKEN_TTL_SECONDS = "3600";
process.env.INTERNAL_SECRET_KEY = "iteration-7-internal-secret";

const express = (await import("express")).default;
const downstreamPrograms = [{
  id: "TEST_PROGRAM",
  program_name: "Test Program",
  college_id: "TEST_COLLEGE",
  min_percentage: 80,
  program_fees: 2000,
  allowed_tracks: "Science",
}];
let forwardedAuthorization = null;

const downstream = express();
downstream.use(express.json());
downstream.use((req, res, next) => {
  if (req.get("x-internal-secret") !== process.env.INTERNAL_SECRET_KEY) {
    return res.status(401).json({ detail: "Invalid internal secret" });
  }
  forwardedAuthorization = req.get("authorization");
  return next();
});
downstream.get("/api/v1/admin/programs", (req, res) => res.json(downstreamPrograms));
downstream.put("/api/v1/admin/programs/:programId", (req, res) => {
  const program = downstreamPrograms.find(item => item.id === req.params.programId);
  if (!program) return res.status(404).json({ detail: "Program not found" });
  Object.assign(program, req.body);
  return res.json({ status: "success", program });
});

const downstreamServer = downstream.listen(0, "127.0.0.1");
await once(downstreamServer, "listening");
process.env.DECISION_API_URL = `http://127.0.0.1:${downstreamServer.address().port}`;

const auth = await import(`../services/authService.js?admin-proxy-test=${Date.now()}`);
const studentPassword = "Student-Password-2026!";
const adminPassword = "Admin-Password-2026!";
process.env.AUTH_USERS_JSON = JSON.stringify([
  {
    subject: "student:proxy-test",
    studentId: "STUDENT-PROXY",
    passwordHash: auth.hashPassword(studentPassword),
    role: "student",
    name: "Proxy Student",
    major: "Testing",
  },
  {
    subject: "admin:proxy-test",
    studentId: "ADMIN-PROXY",
    passwordHash: auth.hashPassword(adminPassword),
    role: "admin",
    name: "Proxy Administrator",
    major: "Administration",
  },
]);

const { default: createAuthRouter } = await import("../routes/auth.js");
const { default: decisionAdminRouter } = await import(`../routes/decisionAdmin.js?admin-proxy-test=${Date.now()}`);

const proxy = express();
proxy.use(express.json());
proxy.use("/api/auth", createAuthRouter());
proxy.use("/api/decision/admin", decisionAdminRouter);

const proxyServer = proxy.listen(0, "127.0.0.1");
await once(proxyServer, "listening");
const proxyBaseUrl = `http://127.0.0.1:${proxyServer.address().port}`;

async function request(pathname, { token, body, ...init } = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return fetch(`${proxyBaseUrl}${pathname}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function login(studentId, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { studentId, password },
  });
  assert.equal(response.status, 200);
  return response.json();
}

try {
  const student = await login("STUDENT-PROXY", studentPassword);
  const admin = await login("ADMIN-PROXY", adminPassword);

  assert.equal((await request("/api/decision/admin/programs")).status, 401);
  assert.equal((await request("/api/decision/admin/programs", { token: student.token })).status, 403);

  const listResponse = await request("/api/decision/admin/programs", { token: admin.token });
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json())[0].min_percentage, 80);
  assert.equal(forwardedAuthorization, `Bearer ${admin.token}`);

  const updateResponse = await request("/api/decision/admin/programs/TEST_PROGRAM", {
    token: admin.token,
    method: "PUT",
    body: { min_percentage: 86.5, program_fees: 2400, allowed_tracks: "Science, Math" },
  });
  assert.equal(updateResponse.status, 200);
  const updatePayload = await updateResponse.json();
  assert.equal(updatePayload.status, "success");
  assert.equal(updatePayload.program.min_percentage, 86.5);

  const readBackResponse = await request("/api/decision/admin/programs", { token: admin.token });
  assert.equal(readBackResponse.status, 200);
  const readBack = await readBackResponse.json();
  assert.deepEqual(readBack[0], updatePayload.program);

  assert.equal((await request("/api/decision/admin/programs/UNKNOWN", {
    token: admin.token,
    method: "PUT",
    body: { min_percentage: 90 },
  })).status, 404);

  const nginxConfig = await fs.readFile(new URL("../../frontend/nginx.conf", import.meta.url), "utf8");
  assert.match(nginxConfig, /location\s+\/api\/\s*\{/);
  assert.match(nginxConfig, /proxy_pass\s+http:\/\/backend:8004\/api\/;/);

  console.log("Admin proxy integration passed (401, 403, bearer forwarding, mutation/read-back, 404, Nginx API route)." );
} finally {
  proxyServer.close();
  downstreamServer.close();
  await Promise.all([once(proxyServer, "close"), once(downstreamServer, "close")]);
}
