import type { Metadata } from "next";
import type { ReactNode } from "react";

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
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}