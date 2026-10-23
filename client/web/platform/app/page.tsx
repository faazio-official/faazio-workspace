import PageClient from "./page.client";

export const metadata = {
  title: "Faazio Partner Portal — Seller & Admin Console",
  description: "Operate the Faazio marketplace: sellers list products and pricing, district admins govern their state, super admins set festival discount caps.",
  robots: { index: false, follow: false },
  openGraph: { title: "Faazio Partner Portal — Seller & Admin Console", description: "Operate the Faazio marketplace: sellers list products and pricing, district admins govern their state, super admins set festival discount caps." },
};

export default function Page() {
  return <PageClient />;
}
