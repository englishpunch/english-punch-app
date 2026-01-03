/**
 * Convex logging utility
 *
 * This utility provides logging functions that only output in non-production environments.
 * In production, console.log calls from Convex are forwarded to the browser console,
 * which can expose sensitive information and clutter the browser console.
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * Log a message (only in non-production environments)
 */
export function log(...args: any[]): void {
  if (!isProduction) {
    console.log(...args);
  }
}

/**
 * Log a warning (only in non-production environments)
 */
export function warn(...args: any[]): void {
  if (!isProduction) {
    console.warn(...args);
  }
}

/**
 * Log an error (always logged, even in production)
 */
export function error(...args: any[]): void {
  console.error(...args);
}

/**
 * Log debug information (only in non-production environments)
 */
export function debug(...args: any[]): void {
  if (!isProduction) {
    console.debug(...args);
  }
}
