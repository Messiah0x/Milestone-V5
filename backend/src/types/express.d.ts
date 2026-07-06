import type { User } from "@prisma/client";
import type { AdminSessionPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      admin?: AdminSessionPayload;
    }
  }
}

export {};
