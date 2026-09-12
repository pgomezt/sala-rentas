import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./operations.css";
export const dynamic="force-dynamic";

export const metadata: Metadata = {
  title: "Sala Rentas · Revisión de tornaguías",
  description: "Observatorio local y revisión de calidad de tornaguías de Cundinamarca.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
