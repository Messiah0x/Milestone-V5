import type { NextFunction, Request, Response } from "express";
import { verifyAdminSession } from "../lib/jwt";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_session;
  if (!token) return res.redirect("/admin/login");

  try {
    req.admin = verifyAdminSession(token);
    next();
  } catch {
    res.clearCookie("admin_session");
    return res.redirect("/admin/login");
  }
}

export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (req.admin?.role !== "SUPERADMIN") {
    return res.status(403).send("Superadmin only");
  }
  next();
}

// A brand manager may only touch their own brand; superadmins pass through.
export function brandScope(req: Request, brandId: string): boolean {
  if (!req.admin) return false;
  if (req.admin.role === "SUPERADMIN") return true;
  return req.admin.brandId === brandId;
}
