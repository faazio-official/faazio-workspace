import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Convenience alias. The merchant agreement has one canonical page so search
 * engines and the seller app share a single source: /seller-terms.
 */
export const Route = createFileRoute("/partner-terms")({
  beforeLoad: () => {
    throw redirect({ to: "/seller-terms", statusCode: 301 });
  },
});
