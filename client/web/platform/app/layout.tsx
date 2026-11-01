import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";

import "@/styles.css";
import { AppContextDetector } from "@/components/layout/AppContextDetector";
import { themeInitScript } from "@/lib/theme";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Faazio Partner Portal",
  description: "Seller and admin console for the Faazio marketplace.",
  authors: [{ name: "Faazio" }],
  robots: { index: false, follow: false },
  openGraph: {
    title: "Faazio Partner Portal",
    description: "Seller and admin console for the Faazio marketplace.",
    type: "website",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/favicon.svg?v=4", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png?v=3", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Both themes get a matching browser chrome colour; the media queries pick
  // the one that matches the OS, and the resolved theme class overrides it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1e26" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resolve auto/light/dark before first paint so the shell never flashes
            the wrong theme. Keep in sync with src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppContextDetector />
        {/* Boundary so the first future page that reads useSearchParams can
            prerender without a build error. Nothing here suspends today. */}
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}