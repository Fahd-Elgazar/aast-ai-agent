import crypto from "crypto";

const SUPPORTED_ROLES = new Set(["student", "guest", "admin"]);
const CONFIGURED_USER_ROLES = new Set(["student", "admin"]);
const DEFAULT_ISSUER = "aast-ai-agent";
const DEFAULT_AUDIENCE = "aast-ai-agent-ui";
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;
const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;

export class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Invalid authentication credentials") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function readJsonSegment(value, label) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new AuthenticationError(`Invalid token ${label}`);
  }
}

function getJwtSecret() {
  const secret = String(process.env.AUTH_JWT_SECRET || "");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new AuthConfigurationError("AUTH_JWT_SECRET must be configured with at least 32 bytes");
  }
  return secret;
}

function getTokenTtlSeconds() {
  const parsed = Number.parseInt(process.env.AUTH_TOKEN_TTL_SECONDS, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TOKEN_TTL_SECONDS;
  return Math.min(Math.max(parsed, 300), 86_400);
}

function getIssuer() {
  return String(process.env.AUTH_JWT_ISSUER || DEFAULT_ISSUER);
}

function getAudience() {
  return String(process.env.AUTH_JWT_AUDIENCE || DEFAULT_AUDIENCE);
}

function normalizeRequiredText(value, field, maxLength = 256) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new AuthConfigurationError(`Invalid ${field} in AUTH_USERS_JSON`);
  }
  return normalized;
}

function normalizeConfiguredUser(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AuthConfigurationError("Every AUTH_USERS_JSON entry must be an object");
  }

  const studentId = normalizeRequiredText(raw.studentId, "studentId", 128);
  const subject = normalizeRequiredText(raw.subject || `user:${studentId}`, "subject", 256);
  const role = normalizeRequiredText(raw.role || "student", "role", 32).toLowerCase();
  const name = normalizeRequiredText(raw.name || studentId, "name", 160);
  if (!CONFIGURED_USER_ROLES.has(role)) {
    throw new AuthConfigurationError("Configured users must have the student or admin role");
  }

  return {
    subject,
    studentId,
    normalizedStudentId: studentId.toLowerCase(),
    passwordHash: normalizeRequiredText(raw.passwordHash, "passwordHash", 1024),
    role,
    name,
    major: typeof raw.major === "string" && raw.major.trim() ? raw.major.trim().slice(0, 160) : "Undeclared",
    avatarUrl: typeof raw.avatarUrl === "string" && raw.avatarUrl.trim()
      ? raw.avatarUrl.trim().slice(0, 1024)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
  };
}

export function getConfiguredUsers() {
  const rawJson = process.env.AUTH_USERS_JSON;
  if (!rawJson || !rawJson.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new AuthConfigurationError("AUTH_USERS_JSON is not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new AuthConfigurationError("AUTH_USERS_JSON must be a JSON array");
  }

  const users = parsed.map(normalizeConfiguredUser);
  const studentIds = new Set();
  const subjects = new Set();
  for (const user of users) {
    if (studentIds.has(user.normalizedStudentId) || subjects.has(user.subject)) {
      throw new AuthConfigurationError("AUTH_USERS_JSON contains a duplicate studentId or subject");
    }
    studentIds.add(user.normalizedStudentId);
    subjects.add(user.subject);
  }
  return users;
}

export function hashPassword(password, { iterations = PASSWORD_ITERATIONS, salt = crypto.randomBytes(16) } = {}) {
  if (typeof password !== "string" || !password || password.length > 1024) {
    throw new Error("Password must be a non-empty string of at most 1024 characters");
  }
  if (!Number.isInteger(iterations) || iterations < 100_000) {
    throw new Error("PBKDF2 iterations must be at least 100000");
  }

  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt), "base64url");
  const digest = crypto.pbkdf2Sync(password, saltBuffer, iterations, PASSWORD_KEY_LENGTH, "sha256");
  return `${PASSWORD_ALGORITHM}$${iterations}$${saltBuffer.toString("base64url")}$${digest.toString("base64url")}`;
}

export function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || password.length > 1024 || typeof encodedHash !== "string") return false;

  const [algorithm, rawIterations, rawSalt, rawDigest, extra] = encodedHash.split("$");
  const iterations = Number.parseInt(rawIterations, 10);
  if (
    extra !== undefined ||
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !rawSalt ||
    !rawDigest
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(rawDigest, "base64url");
    if (expected.length !== PASSWORD_KEY_LENGTH) return false;
    const actual = crypto.pbkdf2Sync(password, Buffer.from(rawSalt, "base64url"), iterations, expected.length, "sha256");
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicPrincipal(principal) {
  return {
    subject: principal.subject,
    role: principal.role,
    studentId: principal.studentId,
    name: principal.name,
    major: principal.major,
    avatarUrl: principal.avatarUrl,
    isGuest: principal.role === "guest",
  };
}

function principalFromConfiguredUser(user) {
  return publicPrincipal(user);
}

export function authenticateCredentials(studentId, password) {
  const normalizedStudentId = typeof studentId === "string" ? studentId.trim().toLowerCase() : "";
  const users = getConfiguredUsers();
  if (users.length === 0) {
    throw new AuthConfigurationError("No student or admin accounts are provisioned in AUTH_USERS_JSON");
  }

  const user = users.find(candidate => candidate.normalizedStudentId === normalizedStudentId);
  if (!user) {
    crypto.pbkdf2Sync(String(password || ""), Buffer.alloc(16), PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256");
    throw new AuthenticationError();
  }

  if (!verifyPassword(password, user.passwordHash)) throw new AuthenticationError();
  return principalFromConfiguredUser(user);
}

export function createGuestPrincipal() {
  if (String(process.env.AUTH_GUEST_ENABLED || "true").toLowerCase() === "false") {
    throw new AuthenticationError("Guest access is disabled");
  }

  return {
    subject: `guest:${crypto.randomUUID()}`,
    role: "guest",
    studentId: "GUEST",
    name: "Prospective Student",
    major: "Undeclared",
    avatarUrl: "https://ui-avatars.com/api/?name=Guest",
    isGuest: true,
  };
}

export function issueAccessToken(principal, { nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const normalized = publicPrincipal(principal);
  if (!normalized.subject || !SUPPORTED_ROLES.has(normalized.role)) {
    throw new AuthConfigurationError("Cannot issue a token for an invalid principal");
  }

  const expiresAt = nowSeconds + getTokenTtlSeconds();
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: getIssuer(),
    aud: getAudience(),
    sub: normalized.subject,
    role: normalized.role,
    student_id: normalized.studentId,
    name: normalized.name,
    major: normalized.major,
    avatar_url: normalized.avatarUrl,
    iat: nowSeconds,
    exp: expiresAt,
    jti: crypto.randomUUID(),
  });
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(signingInput).digest("base64url");

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    user: normalized,
  };
}

export function verifyAccessToken(token, { nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof token !== "string" || token.length > 8192) throw new AuthenticationError();
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthenticationError();

  const [encodedHeader, encodedPayload, suppliedSignature] = parts;
  const header = readJsonSegment(encodedHeader, "header");
  const payload = readJsonSegment(encodedPayload, "payload");
  if (header.alg !== "HS256" || header.typ !== "JWT") throw new AuthenticationError();

  const expectedSignature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  let actualSignature;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new AuthenticationError();
  }
  if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
    throw new AuthenticationError();
  }

  if (
    payload.iss !== getIssuer() ||
    payload.aud !== getAudience() ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    !SUPPORTED_ROLES.has(payload.role) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.iat > nowSeconds + 60 ||
    payload.exp <= nowSeconds
  ) {
    throw new AuthenticationError();
  }

  return publicPrincipal({
    subject: payload.sub,
    role: payload.role,
    studentId: typeof payload.student_id === "string" ? payload.student_id : "",
    name: typeof payload.name === "string" ? payload.name : "",
    major: typeof payload.major === "string" ? payload.major : "Undeclared",
    avatarUrl: typeof payload.avatar_url === "string" ? payload.avatar_url : "",
  });
}

export function authenticateAuthorizationHeader(authorization) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    throw new AuthenticationError("Bearer token required");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new AuthenticationError("Bearer token required");
  return verifyAccessToken(token);
}
