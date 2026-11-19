import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword } from "../services/authService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const script = path.join(backendRoot, "scripts", "provisionCompetitionUsers.js");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aast-auth-provision-"));
const envFile = path.join(temporaryRoot, ".env.appliance.local");

function parseUsers() {
  const line = fs.readFileSync(envFile, "utf8").split(/\r?\n/).find(value => value.startsWith("AUTH_USERS_JSON="));
  assert.ok(line, "AUTH_USERS_JSON must remain present");
  const raw = line.slice("AUTH_USERS_JSON=".length).trim();
  return JSON.parse(raw.slice(1, -1));
}

function provision(accounts) {
  return spawnSync(process.execPath, [script, "--env-file", envFile, "--stdin"], {
    cwd: backendRoot,
    input: JSON.stringify({ accounts }),
    encoding: "utf8",
  });
}

try {
  const adminHash = hashPassword("administrator-test-password");
  fs.writeFileSync(
    envFile,
    [
      "AUTH_JWT_SECRET=test-secret-that-is-longer-than-thirty-two-bytes",
      `AUTH_USERS_JSON='${JSON.stringify([{ subject: "user:ADMIN-TEST", studentId: "ADMIN-TEST", passwordHash: adminHash, role: "admin", name: "Administrator", major: "Administration" }])}'`,
      "AUTH_GUEST_ENABLED=true",
      "",
    ].join("\n"),
    "utf8",
  );

  const first = provision([
    { studentId: "221000001", pin: "111111", name: "Student One" },
    { studentId: "221000002", pin: "222222", name: "Student Two", major: "Artificial Intelligence" },
  ]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Provisioned 2 competition student account/);

  let users = parseUsers();
  assert.equal(users.length, 3, "existing administrator plus two students must be retained");
  assert.ok(users.some(user => user.studentId === "ADMIN-TEST" && user.passwordHash === adminHash));
  assert.ok(verifyPassword("111111", users.find(user => user.studentId === "221000001").passwordHash));
  assert.ok(verifyPassword("222222", users.find(user => user.studentId === "221000002").passwordHash));
  const privateText = fs.readFileSync(envFile, "utf8");
  assert.equal(privateText.includes("111111"), false, "plaintext PIN must not be stored");
  assert.equal(privateText.includes("222222"), false, "plaintext PIN must not be stored");

  const update = provision([{ studentId: "221000001", pin: "333333", name: "Student One Updated" }]);
  assert.equal(update.status, 0, update.stderr);
  users = parseUsers();
  assert.equal(users.length, 3, "upsert must not duplicate an existing student");
  const updatedUser = users.find(user => user.studentId === "221000001");
  assert.equal(updatedUser.name, "Student One Updated");
  assert.equal(verifyPassword("111111", updatedUser.passwordHash), false);
  assert.ok(verifyPassword("333333", updatedUser.passwordHash));

  const beforeInvalidAttempt = fs.readFileSync(envFile, "utf8");
  const invalid = provision([{ studentId: "221000003", pin: "invalid", name: "Invalid Student" }]);
  assert.notEqual(invalid.status, 0, "invalid PIN must be rejected");
  assert.equal(fs.readFileSync(envFile, "utf8"), beforeInvalidAttempt, "a rejected request must not mutate configuration");

  console.log("competitionUserProvisioning.test.js passed secure upsert, hashing, preservation, and rejection cases.");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

