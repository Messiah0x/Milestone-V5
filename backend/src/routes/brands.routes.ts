import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";

export const brandsRouter = Router();

brandsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, logoUrl: true, description: true },
    });
    res.json({ items: brands });
  }),
);

brandsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({ where: { slug: req.params.slug } });
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    res.json(brand);
  }),
);
