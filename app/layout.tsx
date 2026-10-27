import type { Metadata } from "next";
import { Montserrat, Viga } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const viga = Viga({
  variable: "--font-viga",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Panel del club · IN Gorina",
    template: "%s · IN Gorina",
  },
  description: "Panel de administración de IN Padel & Social Club.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${montserrat.variable} ${viga.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
