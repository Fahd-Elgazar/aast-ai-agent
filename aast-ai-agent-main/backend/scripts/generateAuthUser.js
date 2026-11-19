import fs from "node:fs";
import { hashPassword } from "../services/authService.js";

function readArgument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const studentId = readArgument("student-id").trim();
const role = readArgument("role", "student").trim().toLowerCase();
const name = readArgument("name", studentId).trim();
const major = readArgument("major", "Undeclared").trim();
const subject = readArgument("subject", `user:${studentId}`).trim();
const avatarUrl = readArgument("avatar-url", "").trim();

if (!studentId) fail("--student-id is required");
if (!name) fail("--name is required");
if (!subject) fail("--subject must not be empty");
if (!["student", "admin"].includes(role)) fail("--role must be student or admin");

let password = process.env.AUTH_PASSWORD || "";
if (process.argv.includes("--password-stdin")) {
  password = fs.readFileSync(0, "utf8").replace(/[\r\n]+$/, "");
}
if (password.length < 12) fail("Provide a password of at least 12 characters through AUTH_PASSWORD or --password-stdin");

const user = {
  subject,
  studentId,
  passwordHash: hashPassword(password),
  role,
  name,
  major,
  avatarUrl,
};

console.log(JSON.stringify([user]));

