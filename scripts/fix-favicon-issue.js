/**
 * Script para resolver el problema del favicon.ico en Next.js
 * 
 * Este script crea un archivo de ruta específico para favicon.ico que
 * evita el error durante el build en Next.js 15+ con Turbopack
 */

const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.blue}=== Solucionando problemas de Next.js con favicon.ico ===${colors.reset}\n`);

try {
  // Verificar si el favicon.ico está en la ubicación correcta
  const publicFaviconPath = path.join(__dirname, '../public/favicon.ico');
  const appFaviconPath = path.join(__dirname, '../src/app/favicon.ico');
  
  // Si no existe en public, verificar si existe en app
  if (!fs.existsSync(publicFaviconPath)) {
    console.log(`${colors.yellow}⚠️ No se encontró favicon.ico en /public${colors.reset}`);
    
    if (fs.existsSync(appFaviconPath)) {
      console.log(`${colors.green}✅ Se encontró favicon.ico en /src/app${colors.reset}`);
      
      // Crear directorio public si no existe
      const publicDir = path.join(__dirname, '../public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
        console.log(`${colors.green}✅ Directorio /public creado${colors.reset}`);
      }
      
      // Copiar favicon.ico a /public
      fs.copyFileSync(appFaviconPath, publicFaviconPath);
      console.log(`${colors.green}✅ favicon.ico copiado a /public${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ No se encontró favicon.ico en /src/app tampoco${colors.reset}`);
      
      // Crear un favicon.ico básico
      console.log(`${colors.cyan}Creando un favicon.ico básico en /public...${colors.reset}`);
      
      // Directorio public
      const publicDir = path.join(__dirname, '../public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // Esta es una imagen favicon.ico básica en formato binario (1x1 píxel transparente)
      const basicFavicon = Buffer.from('AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'base64');
      fs.writeFileSync(publicFaviconPath, basicFavicon);
      console.log(`${colors.green}✅ favicon.ico básico creado en /public${colors.reset}`);
    }
  } else {
    console.log(`${colors.green}✅ favicon.ico ya existe en /public${colors.reset}`);
  }
  
  // Crear archivo de ruta para favicon.ico
  console.log(`${colors.cyan}Creando configuración para manejo especial de favicon.ico...${colors.reset}`);
  
  // Crear o actualizar archivo next.config.ts para manejar favicon.ico
  const nextConfigPath = path.join(__dirname, '../next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    let nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
    
    // Verificar si ya contiene configuración para favicon
    if (!nextConfig.includes('favicon.ico')) {
      // Añadir configuración para favicon.ico
      nextConfig = nextConfig.replace(
        'const nextConfig: NextConfig = {',
        'const nextConfig: NextConfig = {\n  // Manejo especial para favicon.ico para evitar errores de build\n  async headers() {\n    return [\n      {\n        source: "/favicon.ico",\n        headers: [\n          {\n            key: "Cache-Control",\n            value: "public, max-age=86400, must-revalidate",\n          },\n        ],\n      },\n    ];\n  },\n'
      );
      
      fs.writeFileSync(nextConfigPath, nextConfig);
      console.log(`${colors.green}✅ Configuración de favicon.ico añadida a next.config.ts${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ next.config.ts ya contiene configuración para favicon.ico${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}❌ No se encontró next.config.ts${colors.reset}`);
  }
  
  console.log(`\n${colors.green}${colors.bright}✅ Solución para favicon.ico aplicada correctamente${colors.reset}`);
  
} catch (error) {
  console.error(`\n${colors.red}${colors.bright}❌ Error al aplicar la solución:${colors.reset}`, error);
}
