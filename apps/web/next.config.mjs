import { fileURLToPath } from "node:url";

export default {
  distDir: process.env.TORNAGUIAS_BUILD === "1" ? ".next-production" : ".next",
  poweredByHeader: false,
  turbopack: { root: fileURLToPath(new URL("../../", import.meta.url)) },
};
