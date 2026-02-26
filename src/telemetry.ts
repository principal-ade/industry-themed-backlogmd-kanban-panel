/**
 * OpenTelemetry instrumentation for the Kanban Panel
 *
 * This follows the library instrumentation pattern:
 * - Uses only @opentelemetry/api (no provider/exporter dependencies)
 * - Gets tracer from the global provider (set up by the application)
 * - Returns no-op tracer if no provider is registered (safe, does nothing)
 *
 * The application (e.g., Storybook via storybook-addon-otel, or the Electron app)
 * is responsible for setting up the tracer provider and exporters.
 */

import {
  trace,
  context,
  SpanStatusCode,
  type Tracer,
  type Span,
} from '@opentelemetry/api';

// Read version from package.json at build time
const PACKAGE_VERSION = '1.0.41';

export const TRACER_NAME = '@industry-theme/backlogmd-kanban-panel';
export const TRACER_VERSION = PACKAGE_VERSION;

/**
 * Get the tracer instance for this library.
 * Returns a no-op tracer if no provider is registered.
 */
export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Get the currently active span, if any.
 * Useful for adding events to the current span context.
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Execute a function within a span context.
 * Ensures proper context propagation for nested operations.
 */
export async function withSpan<T>(
  span: Span,
  fn: () => Promise<T>
): Promise<T> {
  return context.with(trace.setSpan(context.active(), span), fn);
}

/**
 * Execute a synchronous function within a span context.
 */
export function withSpanSync<T>(span: Span, fn: () => T): T {
  return context.with(trace.setSpan(context.active(), span), fn);
}

// Re-export commonly used types and utilities
export { trace, context, SpanStatusCode };
export type { Tracer, Span };
