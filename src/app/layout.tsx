import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Grenze_Gotisch, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/providers/Providers";
import "./globals.css";

const grenze = Grenze_Gotisch({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-grenze", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-space", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cursed Code Review — Every bug is a monster", template: "%s · Cursed Code Review" },
  description: "A haunted code review. Bugs crawl out onto the lines where they hide. Fix them to banish them and bring the light back.",
  applicationName: "Cursed Code Review",
  icons: { icon: "/icon.svg" },
  metadataBase: new URL("https://cursed-code-review.vercel.app"),
  openGraph: {
    title: "Cursed Code Review",
    description: "Every bug is a monster. Banish them to bring the light back.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Cursed Code Review", description: "Every bug is a monster. Banish them to bring the light back." },
};

export const viewport: Viewport = { themeColor: "#08090D", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grenze.variable} ${cormorant.variable} ${space.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only z-[70] rounded-lg bg-ember px-4 py-2 font-bold text-ember-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
