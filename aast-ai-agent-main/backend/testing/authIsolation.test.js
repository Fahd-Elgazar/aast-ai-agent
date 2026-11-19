import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const AUTH_SECRET = "iteration-6-auth-test-secret-with-more-than-32-bytes";
const conversationFile = path.join(os.tmpdir(), `aast-auth-isolation-${process.pid}-${Date.now()}.json`);

process.env.AUTH_JWT_SECRET = AUTH_SECRET;
process.env.AUTH_TOKEN_TTL_SECONDS = "3600";
process.env.CONVERSATIONS_FILE = conversationFile;
process.env.CONVERSATION_SAVE_DEBOUNCE_MS = "1";

const auth = await import(`../services/authService.js?auth-test=${Date.now()}`);
const alicePassword = "Alice-Password-2026!";
const bobPassword = "Bob-Password-2026!";
const adminPassword = "Admin-Password-2026!";
process.env.AUTH_USERS_JSON = JSON.stringify([
  {
    subject: "student:alice",
    studentId: "ALICE-001",
    passwordHash: auth.hashPassword(alicePassword),
    role: "student",
    name: "Alice Student",
    major: "Computer Engineering",
    avatarUrl: "",
  },
  {
    subject: "student:bob",
    studentId: "BOB-002",
    passwordHash: auth.hashPassword(bobPassword),
    role: "student",
    name: "Bob Student",
    major: "Software Engineering",
    avatarUrl: "",
  },
  {
    subject: "admin:release",
    studentId: "ADMIN-001",
    passwordHash: auth.hashPassword(adminPassword),
    role: "admin",
    name: "Release Administrator",
    major: "Administration",
    avatarUrl: "",
  },
]);

await fs.writeFile(conversationFile, JSON.stringify({
  version: 1,
  conversations: {
    "legacy-unowned": {
      cid: "legacy-unowned",
      title: "Legacy unowned record",
      messages: [{ role: "user", content: "private legacy content" }],
    },
  },
}), "utf8");

const express = (await import("express")).default;
const { default: createAuthRouter } = await import("../routes/auth.js");
const { default: createConversationsRouter } = await import("../routes/conversations.js");
const { requireAuth, requireRole } = await import("../middleware/auth.js");
const conversationService = await import(`../services/conversationService.js?auth-test=${Date.now()}`);
await conversationService.loadConversations();

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter());
app.use("/api/conversations", createConversationsRouter({
  conversationService,
  onDeleteConversation: async () => {},
}));
app.post("/api/chatbot/query", requireAuth, (req, res) => res.json({ subject: req.auth.subject }));
app.get("/api/admin-gate", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ subject: req.auth.subject, role: req.auth.role });
});

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(pathname, { token, ...init } = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${pathname}`, { ...init, headers });
}

async function login(studentId, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ studentId, password }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

try {
  const alice = await login("ALICE-001", alicePassword);
  const bob = await login("BOB-002", bobPassword);
  const administrator = await login("ADMIN-001", adminPassword);
  assert.equal(auth.verifyAccessToken(alice.token).subject, "student:alice");
  assert.equal(auth.verifyAccessToken(administrator.token).role, "admin");
  assert.match(alice.user.avatarUrl, /^https:\/\//, "configured users must receive a non-empty avatar fallback");
  const aliceTokenParts = alice.token.split(".");
  aliceTokenParts[2] = `${aliceTokenParts[2][0] === "A" ? "B" : "A"}${aliceTokenParts[2].slice(1)}`;
  assert.throws(() => auth.verifyAccessToken(aliceTokenParts.join(".")), auth.AuthenticationError);

  const guestOne = await (await request("/api/auth/guest", { method: "POST" })).json();
  const guestTwo = await (await request("/api/auth/guest", { method: "POST" })).json();
  assert.notEqual(guestOne.user.subject, guestTwo.user.subject);

  assert.equal((await request("/api/conversations")).status, 401, "conversation list must reject anonymous callers");
  assert.equal((await request("/api/chatbot/query", { method: "POST", body: "{}" })).status, 401, "chat must reject anonymous callers");
  assert.equal((await request("/api/chatbot/query", { token: alice.token, method: "POST", body: "{}" })).status, 200);
  assert.equal((await request("/api/admin-gate")).status, 401, "admin gate must reject anonymous callers");
  assert.equal((await request("/api/admin-gate", { token: alice.token })).status, 403, "student must not pass admin gate");
  assert.equal((await request("/api/admin-gate", { token: guestOne.token })).status, 403, "guest must not pass admin gate");
  assert.equal((await request("/api/admin-gate", { token: administrator.token })).status, 200, "admin must pass admin gate");

  const createdResponse = await request("/api/conversations", { token: alice.token, method: "POST", body: "{}" });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).conversation;
  assert.ok(created.cid);
  assert.equal(Object.hasOwn(created, "ownerId"), false, "owner IDs must not be exposed in API payloads");

  const aliceList = await (await request("/api/conversations", { token: alice.token })).json();
  const bobList = await (await request("/api/conversations", { token: bob.token })).json();
  assert.equal(aliceList.conversations.length, 1);
  assert.equal(bobList.conversations.length, 0);
  assert.equal(aliceList.conversations.some(item => item.cid === "legacy-unowned"), false);

  assert.equal((await request(`/api/conversations/${created.cid}`, { token: bob.token })).status, 404);
  assert.equal((await request(`/api/conversations/${created.cid}/title`, {
    token: bob.token,
    method: "PATCH",
    body: JSON.stringify({ title: "stolen" }),
  })).status, 404);
  assert.equal((await request(`/api/conversations/${created.cid}`, { token: bob.token, method: "DELETE" })).status, 404);
  assert.equal((await request(`/api/conversations/${created.cid}`, { token: alice.token })).status, 200);

  await assert.rejects(
    conversationService.getConversation(created.cid, { ownerId: "student:bob" }),
    conversationService.ConversationOwnershipError
  );
  assert.equal(
    conversationService.getConversationById("legacy-unowned", { ownerId: "student:alice" }),
    null,
    "legacy unowned records must remain inaccessible"
  );

  console.log("Authentication and tenant-isolation tests passed (two users, guest uniqueness, 401, 403, owner CRUD, legacy fail-closed).");
} finally {
  server.close();
  await once(server, "close");
  await conversationService.flushConversations();
  await fs.rm(conversationFile, { force: true });
}
