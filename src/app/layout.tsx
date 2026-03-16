import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import { ToasterProvider } from "@/components/toaster-provider";
import "./globals.css";

const headingFont = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Código Secreto en Línea",
  description: "Juego multijugador por salas inspirado en Codenames.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${headingFont.variable} ${bodyFont.variable} antialiased`}>
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
