import express from "express";
import type { Request, Response } from "express";
import { notificationService } from "./services/notificationService.js";

const notificationRouter = express.Router();

// GET /notifications - return all notifications
notificationRouter.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await notificationService.getAllNotifications();
  if (error) {
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
  return res.status(200).json(data);
});

export { notificationRouter };
