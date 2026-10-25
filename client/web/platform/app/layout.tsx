import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";

import "@/styles.css";
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
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png?v=3", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1162D3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Boundary so the first future page that reads useSearchParams can
            prerender without a build error. Nothing here suspends today. */}
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}