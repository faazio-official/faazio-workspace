import { gateway } from '@/services/api/GatewayClient';

/**
 * Release crash observability. Unhandled JS errors and render/lifecycle failures are sent to the
 * gateway `/errors` sink (fire-and-forget). Non-PII by contract: only the message + stack (and
 * ErrorBoundary's component stack) are captured — route params, tokens and keys are never attached.
 * A per-process budget stops a crashing device from hammering the sink.
 */
const MAX_REPORTS_PER_SESSION = 25;
let sent = 0;

function send(error: unknown, scope: string, componentStack?: string): void {
  if (!error || sent >= MAX_REPORTS_PER_SESSION) return;
  sent += 1;
  const err = error instanceof Error ? error : new Error(String(error));
  const message = scope === 'app' ? err.message : `[${scope}] ${err.message}`;
  gateway
    .reportError({ message, stack: err.stack, componentStack })
    .catch(() => undefined);
}

interface ErrorUtils {
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
}

/**
 * Routes unhandled JS errors to the crash sink. Installed module-scope in every app entry
 * (customer/delivery/seller) so it runs before any screen mounts — release builds strip console.*
 * via babel, so without this the crash would be silently swallowed.
 */
export function installGlobalErrorHandlers(scope = 'app'): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtils }).ErrorUtils;
  if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      if (__DEV__) {
        console.warn(`[Faazio:global-error:${scope}]`, isFatal, error);
      }
      send(error, scope);
    });
  }
}

/** Report a caught render/lifecycle error (ErrorBoundary) with its React component stack. */
export function reportRenderError(error: Error, scope: string, componentStack?: string): void {
  send(error, scope, componentStack);
}