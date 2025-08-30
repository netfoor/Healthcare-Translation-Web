import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Advertencias de ESLint no bloquearán el build en producción
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Los errores de TypeScript no bloquearán el build en producción
    ignoreBuildErrors: true,
  },
  // Manejo especial para favicon.ico para evitar errores de build
  async headers() {
    return [
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
    ];
  },
  // Configuración de compilación
  experimental: {
    // Optimizaciones para Amplify CI/CD
    optimizePackageImports: ['aws-amplify'],
  },
  // Configuración de webpack
  webpack: (config) => {
    // Manejar el caso de no encontrar amplify_outputs.json
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    // Optimizaciones para entornos CI/CD
    if (process.env.CI || process.env.NEXT_PUBLIC_IS_AMPLIFY_BUILD === 'true') {
      // Reducir logs en CI
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    
    return config;
  },
  // Optimización de compilación
  output: 'standalone',
  // Reducir tamaño de los paquetes de análisis
  productionBrowserSourceMaps: false,
};

export default nextConfig;
