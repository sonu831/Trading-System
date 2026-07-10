/**
 * Ambient type declarations for Docker absolute-path requires.
 *
 * Layer 2 runs inside Docker where shared/ is mounted at /app/shared/.
 * TypeScript's module resolver doesn't know about this mount point, so the
 * declarations below tell tsc where to find the types for these absolute imports.
 *
 * Runtime is unaffected — Node resolves /app/shared/* on the real filesystem.
 */
declare module '/app/shared/health-check' {
  export * from '../../shared/health-check/index';
}

declare module '/app/shared/constants' {
  export * from '../../shared/constants';
}

declare module '/app/shared' {
  export * from '../../shared/index';
}
