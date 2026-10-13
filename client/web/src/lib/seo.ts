import type { Metadata } from "next";

/** Next.js App Router metadata sibling of {@link pageMeta}. Every route gets unique text. */
export function pageMetadata(title: string, description: string): Metadata {
  const fullTitle = `${title} — Faazio Partner Portal`;
  return {
    title: fullTitle,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: fullTitle, description },
  };
}

/** Builds the per-route head() meta array. Every route gets unique text. */
export function pageMeta(title: string, description: string) {
  const fullTitle = `${title} — Faazio Partner Portal`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  };
}
