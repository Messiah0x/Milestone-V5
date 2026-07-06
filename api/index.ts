// Root-level shim so Vercel's zero-config Node builder (which scans for /api
// at the project's Root Directory) can find the backend's Express app. The
// real implementation lives in /backend — see backend/src/app.ts.
export { default } from "../backend/src/app";
