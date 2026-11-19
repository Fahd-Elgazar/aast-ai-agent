import {
  AuthConfigurationError,
  AuthenticationError,
  authenticateAuthorizationHeader,
} from "../services/authService.js";

function sendAuthError(res, error) {
  if (error instanceof AuthConfigurationError) {
    return res.status(503).json({
      error: "authentication_not_configured",
      message: error.message,
    });
  }

  res.set("WWW-Authenticate", "Bearer");
  return res.status(401).json({
    error: "unauthorized",
    message: error instanceof AuthenticationError ? error.message : "Invalid authentication credentials",
  });
}

export function requireAuth(req, res, next) {
  try {
    req.auth = authenticateAuthorizationHeader(req.get("authorization"));
    return next();
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles);
  return (req, res, next) => {
    if (!req.auth) return sendAuthError(res, new AuthenticationError("Bearer token required"));
    if (!allowed.has(req.auth.role)) {
      return res.status(403).json({
        error: "forbidden",
        message: "This operation requires an authorized role",
      });
    }
    return next();
  };
}

