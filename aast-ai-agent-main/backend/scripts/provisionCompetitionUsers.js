import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "../services/authService.js";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readArgument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

function unwrapEnvValue(value) {
  const trimmed = String(value || "").trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeAccount(raw, index) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`Account ${index + 1} must be an object.`);
  }

  const studentId = String(raw.studentId || "").trim();
  const pin = String(raw.pin || "").trim();
  const name = String(raw.name || "").trim();
  const major = String(raw.major || "Undeclared").trim() || "Undeclared";

  if (!/^\d{9}$/.test(studentId)) {
    fail(`Account ${index + 1} must have a 9-digit registration number.`);
  }
  if (!/^\d{6}$/.test(pin)) {
    fail(`Account ${index + 1} must have a 6-digit competition PIN.`);
  }
  if (!name || name.length > 160) {
    fail(`Account ${index + 1} must have a name of at most 160 characters.`);
  }
  if (major.length > 160) {
    fail(`Account ${index + 1} major must be at most 160 characters.`);
  }

  return { studentId, pin, name, major };
}

const envFileArgument = readArgument("env-file");
if (!envFileArgument) fail("--env-file is required.");
if (!process.argv.includes("--stdin")) fail("--stdin is required; plaintext PINs must not be command-line arguments.");

const envFile = path.resolve(envFileArgument);
if (!fs.existsSync(envFile)) fail(`Environment file does not exist: ${envFile}`);

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  fail("stdin must contain valid JSON.");
}

if (!payload || !Array.isArray(payload.accounts) || payload.accounts.length === 0) {
  fail("stdin JSON must contain a non-empty accounts array.");
}

const accounts = payload.accounts.map(normalizeAccount);
const requestedIds = new Set();
for (const account of accounts) {
  if (requestedIds.has(account.studentId.toLowerCase())) {
    fail("The provisioning request contains a duplicate registration number.");
  }
  requestedIds.add(account.studentId.toLowerCase());
}

const originalText = fs.readFileSync(envFile, "utf8");
const newline = originalText.includes("\r\n") ? "\r\n" : "\n";
const lines = originalText.split(/\r?\n/);
const usersLineIndex = lines.findIndex(line => line.startsWith("AUTH_USERS_JSON="));
if (usersLineIndex < 0) fail("AUTH_USERS_JSON is missing from the environment file.");

let existingUsers;
try {
  existingUsers = JSON.parse(unwrapEnvValue(lines[usersLineIndex].slice("AUTH_USERS_JSON=".length)));
} catch {
  fail("AUTH_USERS_JSON is not valid JSON.");
}
if (!Array.isArray(existingUsers)) fail("AUTH_USERS_JSON must be a JSON array.");

const byStudentId = new Map();
for (const user of existingUsers) {
  const studentId = String(user?.studentId || "").trim();
  if (!studentId) fail("An existing AUTH_USERS_JSON entry has no studentId.");
  const key = studentId.toLowerCase();
  if (byStudentId.has(key)) fail("AUTH_USERS_JSON already contains a duplicate studentId.");
  byStudentId.set(key, user);
}

for (const account of accounts) {
  const key = account.studentId.toLowerCase();
  const previous = byStudentId.get(key);
  if (previous?.role === "admin") {
    fail("Refusing to replace an administrator account with a student account.");
  }

  byStudentId.set(key, {
    subject: previous?.subject || `user:${account.studentId}`,
    studentId: account.studentId,
    passwordHash: hashPassword(account.pin),
    role: "student",
    name: account.name,
    major: account.major,
    avatarUrl: previous?.avatarUrl || "",
  });
}

const mergedUsers = [...byStudentId.values()];
const usersJson = JSON.stringify(mergedUsers);
if (usersJson.includes("'")) {
  fail("AUTH_USERS_JSON contains a single quote and cannot be safely stored in the current env-file format.");
}
for (const account of accounts) {
  if (usersJson.includes(account.pin)) fail("Safety check failed: a plaintext PIN would be written.");
}

lines[usersLineIndex] = `AUTH_USERS_JSON='${usersJson}'`;
const updatedText = lines.join(newline);
const temporaryFile = `${envFile}.${process.pid}.tmp`;

try {
  fs.writeFileSync(temporaryFile, updatedText, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryFile, envFile);
} finally {
  if (fs.existsSync(temporaryFile)) fs.rmSync(temporaryFile, { force: true });
}

console.log(`Provisioned ${accounts.length} competition student account(s); stored PBKDF2 hashes only.`);

