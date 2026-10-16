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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#1162D3" };

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