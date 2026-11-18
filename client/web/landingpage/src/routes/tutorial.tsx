import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Convenience alias. The seller walkthrough has one canonical page so search
 * engines and the seller app share a single source: /help-centre.
 */
export const Route = createFileRoute("/tutorial")({
  beforeLoad: () => {
    throw redirect({ to: "/help-centre", statusCode: 301 });
  },
});
