#!/usr/bin/env node

/**
 * Validación de despliegue en Amplify
 * Este script verifica que todos los requisitos para un despliegue exitoso en Amplify
 * estén cumplidos, sin necesidad de hacer un despliegue completo.
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

console.log(`${colors.bright}${colors.blue}=== Validación de despliegue en Amplify ===${colors.reset}\n`);

const issues = [];
const warnings = [];

try {
  // 1. Verificar que existe el archivo amplify_outputs.json o hay un mecanismo para crearlo
  console.log(`${colors.cyan}Verificando configuración de Amplify...${colors.reset}`);
  const outputsPath = path.join(__dirname, '../amplify_outputs.json');
  const prepareBuildPath = path.join(__dirname, './prepare-build.js');
  
  if (fs.existsSync(outputsPath)) {
    console.log(`✅ El archivo amplify_outputs.json existe`);
    
    // Validar estructura del archivo
    try {
      const outputs = require(outputsPath);
      if (!outputs.auth?.user_pool_id || !outputs.data?.url) {
        warnings.push('El archivo amplify_outputs.json existe pero puede faltar información esencial (auth.user_pool_id o data.url)');
      }
    } catch (error) {
      issues.push(`Error al leer amplify_outputs.json: ${error.message}`);
    }
  } else {
    if (fs.existsSync(prepareBuildPath)) {
      console.log(`⚠️ No se encontró amplify_outputs.json, pero existe el script prepare-build.js`);
      warnings.push('No existe amplify_outputs.json. Se creará uno temporal, pero puede que falte configuración real de Amplify.');
    } else {
      issues.push('No existe amplify_outputs.json ni un mecanismo para crearlo automáticamente');
    }
  }
  
  // 2. Verificar script prebuild en package.json
  console.log(`\n${colors.cyan}Verificando scripts de package.json...${colors.reset}`);
  const packageJsonPath = path.join(__dirname, '../package.json');
  let hasPreBuildScript = false;
  
  try {
    const packageJson = require(packageJsonPath);
    if (packageJson.scripts && packageJson.scripts.prebuild) {
      console.log(`✅ Script 'prebuild' encontrado: ${packageJson.scripts.prebuild}`);
      hasPreBuildScript = true;
    } else {
      warnings.push('No se encontró script "prebuild" en package.json');
    }
    
    // Verificar que el script build existe
    if (packageJson.scripts && packageJson.scripts.build) {
      console.log(`✅ Script 'build' encontrado: ${packageJson.scripts.build}`);
    } else {
      issues.push('No se encontró script "build" en package.json');
    }
  } catch (error) {
    issues.push(`Error al leer package.json: ${error.message}`);
  }
  
  // 3. Verificar configuración de Next.js
  console.log(`\n${colors.cyan}Verificando configuración de Next.js...${colors.reset}`);
  const nextConfigPath = path.join(__dirname, '../next.config.ts');
  
  if (fs.existsSync(nextConfigPath)) {
    const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    if (nextConfigContent.includes('ignoreDuringBuilds: true')) {
      console.log('✅ ESLint está configurado para ignorar errores durante el build');
    } else {
      warnings.push('ESLint podría bloquear el build en Amplify si hay errores');
    }
    
    if (nextConfigContent.includes('ignoreBuildErrors: true')) {
      console.log('✅ TypeScript está configurado para ignorar errores durante el build');
    } else {
      warnings.push('TypeScript podría bloquear el build en Amplify si hay errores');
    }
    
    if (nextConfigContent.includes('webpack: (config)') && 
        nextConfigContent.includes('fallback')) {
      console.log('✅ Webpack está configurado con fallbacks para módulos faltantes');
    } else {
      warnings.push('La configuración de webpack podría no manejar correctamente módulos faltantes');
    }
  } else {
    warnings.push('No se encontró archivo next.config.ts');
  }
  
  // 4. Verificar variables de entorno
  console.log(`\n${colors.cyan}Verificando variables de entorno...${colors.reset}`);
  const envLocalPath = path.join(__dirname, '../.env.local');
  const envAmplifyPath = path.join(__dirname, '../.env.amplify');
  
  if (fs.existsSync(envLocalPath)) {
    console.log('✅ Archivo .env.local encontrado');
  } else {
    warnings.push('No se encontró archivo .env.local');
  }
  
  if (fs.existsSync(envAmplifyPath)) {
    console.log('✅ Archivo .env.amplify encontrado');
    
    // Verificar AMPLIFY_APP_URL
    const envContent = fs.readFileSync(envAmplifyPath, 'utf8');
    if (envContent.includes('AMPLIFY_APP_URL=')) {
      console.log('✅ Variable AMPLIFY_APP_URL encontrada en .env.amplify');
    } else {
      warnings.push('No se encontró AMPLIFY_APP_URL en .env.amplify');
    }
  } else {
    warnings.push('No se encontró archivo .env.amplify. Ejecuta: npm run update-amplify-urls https://tu-app.amplifyapp.com');
  }
  
  // 5. Ejecutar un build rápido para detectar errores
  console.log(`\n${colors.cyan}Ejecutando verificación de build...${colors.reset}`);
  try {
    // Ejecutar el script de prebuild si existe
    if (hasPreBuildScript) {
      console.log('Ejecutando script prebuild...');
      execSync('npm run prebuild', { stdio: 'inherit' });
    }
    
    // Verificar si podemos hacer un build exitoso (con --no-lint para acelerar)
    console.log('Ejecutando verificación de compilación (esto puede tomar un momento)...');
    execSync('npx next build --no-lint', { stdio: 'pipe' });
    console.log('✅ La verificación de build se completó exitosamente');
  } catch (error) {
    issues.push(`Error durante la verificación de build: ${error.message}`);
  }
  
  // 6. Mostrar resumen
  console.log(`\n${colors.bright}${colors.blue}=== Resumen de la validación ===${colors.reset}`);
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log(`\n${colors.green}${colors.bright}✅ ¡Todo está listo para desplegar en Amplify!${colors.reset}`);
    console.log(`\nPuedes ejecutar el despliegue con:`);
    console.log(`${colors.cyan}npm run update-amplify-urls https://tu-app.amplifyapp.com${colors.reset}`);
    console.log(`${colors.cyan}npm run deploy${colors.reset}`);
  } else {
    if (issues.length > 0) {
      console.log(`\n${colors.red}${colors.bright}❌ Problemas que deben corregirse:${colors.reset}`);
      issues.forEach((issue, index) => {
        console.log(`${colors.red}${index + 1}. ${issue}${colors.reset}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bright}⚠️ Advertencias (pueden no bloquear el despliegue):${colors.reset}`);
      warnings.forEach((warning, index) => {
        console.log(`${colors.yellow}${index + 1}. ${warning}${colors.reset}`);
      });
    }
    
    if (issues.length > 0) {
      console.log(`\n${colors.red}${colors.bright}❌ Se encontraron problemas que podrían impedir el despliegue en Amplify.${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}${colors.bright}⚠️ Se encontraron advertencias, pero probablemente se puede desplegar en Amplify.${colors.reset}`);
    }
  }
  
} catch (error) {
  console.error(`\n${colors.red}${colors.bright}Error durante la validación:${colors.reset}`, error);
  process.exit(1);
}
