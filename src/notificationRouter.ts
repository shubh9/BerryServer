import express from "express";
import type { Request, Response } from "express";
import { notificationService } from "./services/notificationService.js";

const notificationRouter = express.Router();

// GET /notifications?userId=xxx - return notifications for a user
notificationRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res
      .status(400)
      .json({ error: "userId query parameter is required" });
  }

  const { data, error } = await notificationService.getNotificationsByUserId(
    userId
  );
  if (error) {
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
  return res.status(200).json(data);
});

export { notificationRouter };
