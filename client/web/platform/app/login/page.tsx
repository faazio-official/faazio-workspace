import PageClient from "./page.client";

export const metadata = {
  title: "Sign in — Faazio Partner Portal",
  description: "Secure sign-in for seller, state admin and super admin consoles.",
  robots: { index: false, follow: false },
  openGraph: { title: "Sign in — Faazio Partner Portal", description: "Secure sign-in for seller, state admin and super admin consoles." },
};

export default function Page() {
  return <PageClient />;
}
