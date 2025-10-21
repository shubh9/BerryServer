import express from "express";
import type { Request, Response } from "express";
import { ruleRouter } from "./ruleRouter.js";
import { notificationRouter } from "./notificationRouter.js";

const app = express();
const PORT = process.env.PORT;

// Middleware to parse JSON bodies and preserve raw body for QStash signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use((req: Request, _res: Response, next) => {
  console.log(`${req.method} - ${req.url}`);
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello world");
});
app.use("/notifications", notificationRouter);
app.use("/rule", ruleRouter);
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server listening at ${url}`);
});
