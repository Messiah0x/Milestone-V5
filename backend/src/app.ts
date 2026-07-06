import "./env"; // validate env before anything else touches it
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { corsOrigins } from "./env";
import { errorHandler } from "./middleware/errorHandler";
import { stripeWebhookHandler } from "./routes/webhooks.routes";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";
import { brandsRouter } from "./routes/brands.routes";
import { campaignsRouter } from "./routes/campaigns.routes";
import { questsRouter } from "./routes/quests.routes";
import { cratesRouter } from "./routes/crates.routes";
import { billingRouter } from "./routes/billing.routes";
import { linkRouter } from "./routes/link.routes";
import { webhooksRouter } from "./routes/webhooks.routes";
import { adminRouter } from "./routes/admin.routes";

export const app = express();

// Running behind Vercel's proxy — required for express-rate-limit and req.ip
// to see the real client IP instead of throwing on X-Forwarded-For.
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  }),
);

// Stripe needs the raw, unparsed body to verify its signature — must be
// registered before the global express.json() below.
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/brands", brandsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/quests", questsRouter);
app.use("/api/crates", cratesRouter);
app.use("/api/billing", billingRouter);
app.use("/api/link", linkRouter);
app.use("/link", linkRouter); // GET /link/telegram (browser-facing, no /api prefix)
app.use("/api/webhooks", webhooksRouter);

app.use("/admin", adminRouter);

app.use(errorHandler);
