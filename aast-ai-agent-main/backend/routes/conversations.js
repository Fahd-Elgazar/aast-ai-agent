import express from "express";

export default function createConversationsRouter({
  conversationService,
  onDeleteConversation
}) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const conversations = conversationService.listConversations({
      search: typeof req.query.search === "string" ? req.query.search : ""
    });

    res.json({ conversations });
  });

  router.post("/", (req, res) => {
    const conversation = conversationService.createConversation();
    res.status(201).json({ conversation });
  });

  router.get("/:cid", (req, res) => {
    const conversation = conversationService.getConversationById(req.params.cid, {
      includeMessages: true
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
        conversation = await conversationService.renameConversation(req.params.cid, req.body.title);
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, "pinned")) {
        conversation = await conversationService.pinConversation(req.params.cid, req.body.pinned);
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
      const conversation = await conversationService.renameConversation(req.params.cid, req.body?.title);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json({ conversation });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch("/:cid/pin", async (req, res) => {
    const conversation = await conversationService.pinConversation(req.params.cid, req.body?.pinned !== false);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ conversation });
  });

  router.delete("/:cid", async (req, res) => {
    const deleted = await conversationService.deleteConversation(req.params.cid);
    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    try {
      if (typeof onDeleteConversation === "function") {
        await onDeleteConversation(req.params.cid);
      }
    } catch (err) {
      console.warn("Conversation deleted, but related memory cleanup failed:", err.message);
    }

    res.status(204).send();
  });

  return router;
}
