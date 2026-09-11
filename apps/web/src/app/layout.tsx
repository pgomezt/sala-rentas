import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sala Rentas · Entorno de desarrollo",
  description: "Preparacion local del observatorio de tornaguias de Cundinamarca.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}

