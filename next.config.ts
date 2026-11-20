import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { numeroWhatsAppAsesor } from "./lib/whatsapp-asesor.mjs";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL_ENV === "production" && !numeroWhatsAppAsesor()) {
    throw new Error("Configura NEXT_PUBLIC_WHATSAPP_ASESOR con el número internacional real de Sergio en el entorno Production de Vercel.");
  }
  return nextConfig;
}
