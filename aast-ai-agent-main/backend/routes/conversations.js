import express from "express";
import { requireAuth } from "../middleware/auth.js";

export default function createConversationsRouter({
  conversationService,
  onDeleteConversation
}) {
  const router = express.Router();
  router.use(requireAuth);

  router.get("/", (req, res) => {
    const conversations = conversationService.listConversations({
      search: typeof req.query.search === "string" ? req.query.search : "",
      ownerId: req.auth.subject,
    });

    res.json({ conversations });
  });

  router.post("/", (req, res) => {
    const conversation = conversationService.createConversation({ ownerId: req.auth.subject });
    res.status(201).json({ conversation });
  });

  router.get("/:cid", (req, res) => {
    const conversation = conversationService.getConversationById(req.params.cid, {
      includeMessages: true,
      ownerId: req.auth.subject,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ conversation });
  });

  router.patch("/:cid", async (req, res) => {
    try {
      let conversation = null;

      if (Object.prototype.hasOwnProperty.call(req.body || {}, "title")) {
        conversation = await conversationService.renameConversation(req.params.cid, req.body.title, {
          ownerId: req.auth.subject,
        });
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, "pinned")) {
        conversation = await conversationService.pinConversation(req.params.cid, req.body.pinned, {
          ownerId: req.auth.subject,
        });
      }

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json({ conversation });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch("/:cid/title", async (req, res) => {
    try {
      const conversation = await conversationService.renameConversation(req.params.cid, req.body?.title, {
        ownerId: req.auth.subject,
      });
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json({ conversation });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch("/:cid/pin", async (req, res) => {
    const conversation = await conversationService.pinConversation(req.params.cid, req.body?.pinned !== false, {
      ownerId: req.auth.subject,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ conversation });
  });

  router.delete("/:cid", async (req, res) => {
    const deleted = await conversationService.deleteConversation(req.params.cid, {
      ownerId: req.auth.subject,
    });
    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    try {
      if (typeof onDeleteConversation === "function") {
        await onDeleteConversation(req.params.cid, { ownerId: req.auth.subject });
      }
    } catch (err) {
      console.warn("Conversation deleted, but related memory cleanup failed:", err.message);
    }

    res.status(204).send();
  });

  return router;
}
