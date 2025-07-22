import express from "express";
import type { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello world");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
