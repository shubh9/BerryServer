// Type augmentation for Express to include rawBody set in express.json verify
import type { Buffer } from "node:buffer";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export {};
