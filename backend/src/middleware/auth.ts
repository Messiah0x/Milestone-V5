import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifySession } from "../lib/jwt";
import { HttpError } from "./errorHandler";
import { asyncHandler } from "./asyncHandler";

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  const token = header.slice("Bearer ".length);
  let payload;
  try {
    payload = verifySession(token);
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new HttpError(401, "User not found");
  }

  req.user = user;
  next();
});

// Attaches req.user if a valid token is present, but doesn't reject when absent.
// Used by endpoints that are public but personalize output when authenticated.
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const payload = verifySession(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) req.user = user;
  } catch {
    // ignore invalid tokens on optional routes
  }
  next();
});
