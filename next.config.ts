import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/encuesta.html", destination: "/encuesta", permanent: true },
      { source: "/mapa.html", destination: "/mapa", permanent: true },
      { source: "/sintesis.html", destination: "/sintesis", permanent: true },
      { source: "/insumos.html", destination: "/insumos", permanent: true },
      { source: "/admin.html", destination: "/admin", permanent: true },
    ];
  },
};

export default nextConfig;
