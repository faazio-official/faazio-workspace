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
