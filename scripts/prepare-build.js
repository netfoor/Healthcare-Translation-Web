#!/usr/bin/env node

/**
 * Prepara un archivo amplify_outputs.json para el build
 * Este script crea un archivo de configuración de Amplify temporal
 * que permite que el build funcione incluso sin una configuración real de Amplify
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

console.log(`${colors.bright}${colors.blue}=== Preparando entorno para build ===${colors.reset}\n`);

// Verificar si estamos en Amplify CI/CD
const isAmplifyBuild = process.env.AWS_APP_ID || process.env.AMPLIFY_APP_ID;
if (isAmplifyBuild) {
  console.log(`${colors.cyan}Detectado entorno de Amplify CI/CD${colors.reset}`);
}

// Rutas de archivos importantes
const outputsPath = path.join(__dirname, '../amplify_outputs.json');
const envLocalPath = path.join(__dirname, '../.env.local');

// Mock amplify outputs para que el build funcione
const mockOutputs = {
  auth: {
    user_pool_id: 'mock-user-pool-id',
    identity_pool_id: 'mock-identity-pool-id',
    web_client_id: 'mock-web-client-id',
    oauth: {
      domain: 'mock-domain',
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: ['http://localhost:3000/'],
      redirectSignOut: ['http://localhost:3000/'],
      responseType: 'code'
    }
  },
  data: {
    url: 'mock-api-url',
    region: 'us-east-1'
  }
};

// 1. Gestionar archivo amplify_outputs.json
console.log(`${colors.cyan}Verificando archivo amplify_outputs.json...${colors.reset}`);
if (!fs.existsSync(outputsPath)) {
  console.log('📄 Creando archivo amplify_outputs.json para el build...');
  fs.writeFileSync(outputsPath, JSON.stringify(mockOutputs, null, 2));
  console.log(`${colors.green}✅ Archivo creado en: ${outputsPath}${colors.reset}`);
} else {
  console.log(`${colors.green}✅ El archivo amplify_outputs.json ya existe${colors.reset}`);
  
  // Verificar si el archivo tiene el formato correcto
  try {
    const existingOutputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
    if (!existingOutputs.auth || !existingOutputs.data) {
      console.log(`${colors.yellow}⚠️ El archivo amplify_outputs.json parece incompleto, actualizando...${colors.reset}`);
      fs.writeFileSync(outputsPath, JSON.stringify(mockOutputs, null, 2));
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️ Error al leer amplify_outputs.json, recreando el archivo...${colors.reset}`);
    fs.writeFileSync(outputsPath, JSON.stringify(mockOutputs, null, 2));
  }
}

// 2. Gestionar archivo .env.local si no existe
console.log(`\n${colors.cyan}Verificando variables de entorno...${colors.reset}`);
if (!fs.existsSync(envLocalPath)) {
  console.log('📄 Creando archivo .env.local para el build...');
  
  const envContent = `NEXT_PUBLIC_SKIP_AMPLIFY_AUTH=true
NEXT_PUBLIC_USE_MOCK_DATA=true
NEXT_PUBLIC_WEBSOCKET_FALLBACK_ENABLED=true
NEXT_PUBLIC_IS_AMPLIFY_BUILD=${isAmplifyBuild ? 'true' : 'false'}`;
  
  fs.writeFileSync(envLocalPath, envContent);
  console.log(`${colors.green}✅ Archivo .env.local creado${colors.reset}`);
} else {
  console.log(`${colors.green}✅ El archivo .env.local ya existe${colors.reset}`);
  
  // Actualizar NEXT_PUBLIC_IS_AMPLIFY_BUILD
  let envContent = fs.readFileSync(envLocalPath, 'utf8');
  if (!envContent.includes('NEXT_PUBLIC_IS_AMPLIFY_BUILD')) {
    envContent += `\nNEXT_PUBLIC_IS_AMPLIFY_BUILD=${isAmplifyBuild ? 'true' : 'false'}`;
    fs.writeFileSync(envLocalPath, envContent);
    console.log(`${colors.green}✅ Variable NEXT_PUBLIC_IS_AMPLIFY_BUILD añadida a .env.local${colors.reset}`);
  }
}

// 3. Corregir problemas conocidos
console.log(`\n${colors.cyan}Corrigiendo problemas conocidos...${colors.reset}`);

// Problema de favicon.ico
try {
  console.log('Ejecutando script para solucionar problema de favicon.ico...');
  require('./fix-favicon-issue');
} catch (error) {
  console.log(`${colors.yellow}⚠️ No se pudo ejecutar el script fix-favicon-issue.js: ${error.message}${colors.reset}`);
  
  // Intentar crear manualmente un favicon básico en /public
  try {
    const publicDir = path.join(__dirname, '../public');
    const publicFaviconPath = path.join(publicDir, 'favicon.ico');
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    if (!fs.existsSync(publicFaviconPath)) {
      // Imagen favicon.ico básica en formato binario (1x1 píxel transparente)
      const basicFavicon = Buffer.from('AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'base64');
      fs.writeFileSync(publicFaviconPath, basicFavicon);
      console.log(`${colors.green}✅ favicon.ico básico creado manualmente en /public${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.yellow}⚠️ No se pudo crear favicon.ico: ${e.message}${colors.reset}`);
  }
}

// 4. Verificar si hay problemas con la caché de Next.js
if (isAmplifyBuild) {
  console.log(`\n${colors.cyan}Limpiando caché de Next.js para entorno de Amplify...${colors.reset}`);
  try {
    const nextCacheDir = path.join(__dirname, '../.next/cache');
    if (fs.existsSync(nextCacheDir)) {
      fs.rmSync(nextCacheDir, { recursive: true, force: true });
      console.log(`${colors.green}✅ Caché de Next.js eliminada${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️ No se pudo limpiar la caché de Next.js: ${error.message}${colors.reset}`);
  }
}

console.log(`\n${colors.bright}${colors.green}✅ Entorno preparado para build${colors.reset}`);
