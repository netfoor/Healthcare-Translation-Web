#!/usr/bin/env node

/**
 * Script de optimización para CI/CD de Amplify
 * 
 * Este script se ejecuta antes del despliegue en Amplify para
 * optimizar el proceso de build y evitar errores comunes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log(`${colors.bright}${colors.blue}=== Optimización para CI/CD de Amplify ===${colors.reset}\n`);

// Verificar entorno
const isAmplify = !!process.env.AWS_APP_ID;
console.log(`Entorno: ${isAmplify ? 'Amplify CI/CD' : 'Local'}`);

try {
  // 1. Verificar y corregir problema de favicon.ico
  console.log(`\n${colors.cyan}Verificando problema de favicon.ico...${colors.reset}`);
  
  // Asegurarse de que existe en public
  const publicFaviconPath = path.join(__dirname, '../public/favicon.ico');
  if (!fs.existsSync(publicFaviconPath)) {
    console.log('Creando favicon.ico en /public...');
    
    // Crear directorio si no existe
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Crear favicon.ico básico
    const basicFavicon = Buffer.from('AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'base64');
    fs.writeFileSync(publicFaviconPath, basicFavicon);
    console.log(`${colors.green}✅ favicon.ico creado en /public${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ favicon.ico ya existe en /public${colors.reset}`);
  }
  
  // 2. Verificar .next/server/app/favicon.ico
  console.log(`\n${colors.cyan}Verificando estructura de directorios .next...${colors.reset}`);
  const nextDir = path.join(__dirname, '../.next');
  if (fs.existsSync(nextDir)) {
    console.log(`Limpiando directorio .next para evitar problemas...`);
    try {
      fs.rmSync(nextDir, { recursive: true, force: true });
      console.log(`${colors.green}✅ Directorio .next eliminado para reconstrucción limpia${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}⚠️ No se pudo eliminar directorio .next: ${error.message}${colors.reset}`);
    }
  }
  
  // 3. Crear archivo personalizado para Amplify CI/CD
  if (isAmplify) {
    console.log(`\n${colors.cyan}Creando archivos específicos para Amplify...${colors.reset}`);
    
    // Crear archivo de ruta para favicon.ico para evitar errores
    const faviconRouteDir = path.join(__dirname, '../src/app/favicon.ico');
    if (!fs.existsSync(faviconRouteDir)) {
      const appDir = path.join(__dirname, '../src/app');
      if (fs.existsSync(appDir)) {
        // Copiar favicon.ico a /src/app si existe /public/favicon.ico
        if (fs.existsSync(publicFaviconPath)) {
          fs.copyFileSync(publicFaviconPath, path.join(appDir, 'favicon.ico'));
          console.log(`${colors.green}✅ favicon.ico copiado a /src/app${colors.reset}`);
        }
      }
    }
  }
  
  // 4. Verificar configuración de Next.js
  console.log(`\n${colors.cyan}Verificando configuración de Next.js...${colors.reset}`);
  const nextConfigPath = path.join(__dirname, '../next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    // Verificar que incluye manejo de favicon
    if (!configContent.includes('favicon.ico')) {
      console.log(`${colors.yellow}⚠️ next.config.ts no incluye configuración para favicon.ico${colors.reset}`);
      console.log('Ejecute el script fix-favicon-issue.js para corregir este problema.');
    } else {
      console.log(`${colors.green}✅ next.config.ts incluye configuración para favicon.ico${colors.reset}`);
    }
  }
  
  // 5. Verificar problemas conocidos de Next.js con Turbopack
  console.log(`\n${colors.cyan}Verificando problemas conocidos con Turbopack...${colors.reset}`);
  const packageJsonPath = path.join(__dirname, '../package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Verificar si build usa turbopack
    if (packageJson.scripts && packageJson.scripts.build && packageJson.scripts.build.includes('--turbopack')) {
      console.log(`${colors.yellow}⚠️ Detección de uso de Turbopack en script de build${colors.reset}`);
      
      // Si estamos en Amplify, modificar el script para quitar turbopack
      if (isAmplify) {
        console.log('Modificando script de build para entorno Amplify...');
        packageJson.scripts.build = packageJson.scripts.build.replace('--turbopack', '');
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`${colors.green}✅ Turbopack desactivado para build en Amplify${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Se recomienda quitar --turbopack del script build para Amplify${colors.reset}`);
      }
    }
  }
  
  console.log(`\n${colors.bright}${colors.green}✅ Optimizaciones para Amplify completadas${colors.reset}`);
  
} catch (error) {
  console.error(`\n${colors.red}${colors.bright}❌ Error durante la optimización:${colors.reset}`, error);
}
