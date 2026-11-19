import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  AuthConfigurationError,
  AuthenticationError,
  authenticateCredentials,
  createGuestPrincipal,
  issueAccessToken,
} from "../services/authService.js";

function sendLoginError(res, error) {
  if (error instanceof AuthConfigurationError) {
    return res.status(503).json({ error: "authentication_not_configured", message: error.message });
  }
  if (error instanceof AuthenticationError) {
    return res.status(401).json({ error: "invalid_credentials", message: error.message });
  }
  console.error("Authentication request failed:", error);
  return res.status(500).json({ error: "authentication_failed", message: "Authentication failed" });
}

export default function createAuthRouter() {
  const router = express.Router();

  router.post("/login", (req, res) => {
    try {
      const principal = authenticateCredentials(req.body?.studentId, req.body?.password);
      return res.json(issueAccessToken(principal));
    } catch (error) {
      return sendLoginError(res, error);
    }
  });

  router.post("/guest", (req, res) => {
    try {
      return res.status(201).json(issueAccessToken(createGuestPrincipal()));
    } catch (error) {
      return sendLoginError(res, error);
    }
  });

  router.get("/me", requireAuth, (req, res) => {
    return res.json({ user: req.auth });
  });

  return router;
}

