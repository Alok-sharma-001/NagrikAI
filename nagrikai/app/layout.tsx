import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { PrefsProvider } from "@/components/ui";
import "./globals.css";

const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-noto-deva", display: "swap" });

export const metadata: Metadata = {
  title: "NagrikAI — नागरिक AI",
  description: "Find the government schemes you qualify for — by voice, in Hindi or English.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d91",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body className={`${noto.variable} ${notoDeva.variable} antialiased`}>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
