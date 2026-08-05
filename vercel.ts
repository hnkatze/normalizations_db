import type { VercelConfig } from '@vercel/config/v1';

// Pinning the framework here keeps the Next.js build output in play. Without it
// the project falls back to the "Other" preset, which serves public/ as a static
// site and drops every route and function on the floor.
export const config: VercelConfig = {
  framework: 'nextjs',
};
