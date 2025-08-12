import express from "express";
import type { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello world");
});

app.post("/rule", (req: Request, res: Response) => {
  const { userId, textPrompt } = req.body;

  console.log("POST /rule received:");
  console.log("userId:", userId);
  console.log("textPrompt:", textPrompt);

  res.status(200).json({
    message: "Rule data received successfully",
    userId,
    textPrompt,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
