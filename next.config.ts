import type { NextConfig } from "next";

/** Puerto donde `npm run dev:parser` expone la función de parseo. */
const PARSE_DEV_PORT = process.env.PARSE_DEV_PORT ?? "8787";

const nextConfig: NextConfig = {
  /**
   * En desarrollo, `/api/parse` apunta al servicio de Python corriendo aparte.
   *
   * `next dev` no ejecuta funciones de Python — en producción las corre Vercel
   * desde `api/parse.py`, pero en local nadie las levanta y la ruta devolvería
   * 404. La reescritura solo existe en desarrollo: desplegado, la función es la
   * que responde y meter una reescritura la taparía.
   */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/parse",
        destination: `http://127.0.0.1:${PARSE_DEV_PORT}/api/parse`,
      },
    ];
  },
};

export default nextConfig;
