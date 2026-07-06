import jwt from "jsonwebtoken";
import { env } from "../env";

export interface SessionPayload {
  sub: string; // User.id
}

const EXPIRY = "7d";

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRY });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
}

export interface AdminSessionPayload {
  sub: string; // AdminUser.id
  role: "SUPERADMIN" | "BRAND_MANAGER";
  brandId: string | null;
}

export function signAdminSession(payload: AdminSessionPayload): string {
  return jwt.sign(payload, env.ADMIN_SESSION_SECRET, { expiresIn: "12h" });
}

export function verifyAdminSession(token: string): AdminSessionPayload {
  return jwt.verify(token, env.ADMIN_SESSION_SECRET) as AdminSessionPayload;
}
