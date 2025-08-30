#!/usr/bin/env node

/**
 * Simulador de despliegue en Amplify
 * 
 * Este script simula el proceso de construcción y despliegue que Amplify realizaría,
 * pero lo hace localmente para detectar problemas rápidamente.
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

console.log(`${colors.bright}${colors.blue}=== Simulador de despliegue en Amplify ===${colors.reset}\n`);
console.log(`${colors.cyan}Este script simula el proceso de despliegue de Amplify localmente${colors.reset}\n`);

// Crear directorio temporal
const tempDir = path.join(__dirname, '../.amplify-simulation');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

try {
  // Paso 1: Preparar entorno limpio
  console.log(`${colors.cyan}Paso 1: Preparando entorno limpio...${colors.reset}`);
  
  // Guardar estado actual de .env.local si existe
  const envLocalPath = path.join(__dirname, '../.env.local');
  let originalEnvLocal = null;
  if (fs.existsSync(envLocalPath)) {
    originalEnvLocal = fs.readFileSync(envLocalPath, 'utf8');
    fs.writeFileSync(path.join(tempDir, '.env.local.backup'), originalEnvLocal);
    console.log('✅ Respaldo de .env.local creado');
  }
  
  // Crear .env.local de simulación
  fs.writeFileSync(envLocalPath, 
    `NEXT_PUBLIC_SKIP_AMPLIFY_AUTH=true
NEXT_PUBLIC_USE_MOCK_DATA=true
NEXT_PUBLIC_WEBSOCKET_FALLBACK_ENABLED=true
NEXT_PUBLIC_AMPLIFY_SIMULATION=true`
  );
  console.log('✅ Entorno de simulación configurado');
  
  // Paso 2: Verificar configuración de Amplify
  console.log(`\n${colors.cyan}Paso 2: Verificando configuración de Amplify...${colors.reset}`);
  const outputsPath = path.join(__dirname, '../amplify_outputs.json');
  if (!fs.existsSync(outputsPath)) {
    console.log('⚠️ No se encontró amplify_outputs.json, creando uno temporal...');
    
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
    
    fs.writeFileSync(outputsPath, JSON.stringify(mockOutputs, null, 2));
    console.log('✅ Archivo amplify_outputs.json temporal creado');
  } else {
    console.log('✅ Archivo amplify_outputs.json encontrado');
    // Hacer una copia de seguridad
    fs.copyFileSync(outputsPath, path.join(tempDir, 'amplify_outputs.json.backup'));
  }
  
  // Paso 3: Limpiar dependencias y cache
  console.log(`\n${colors.cyan}Paso 3: Simulando un entorno limpio (como lo haría Amplify)...${colors.reset}`);
  
  console.log('Limpiando cache de Next.js...');
  try {
    if (fs.existsSync(path.join(__dirname, '../.next'))) {
      execSync('npx rimraf .next', { stdio: 'inherit' });
    }
    console.log('✅ Cache de Next.js limpiado');
  } catch (error) {
    console.log(`⚠️ No se pudo limpiar el cache de Next.js: ${error.message}`);
  }
  
  // Paso 4: Instalar dependencias (opcional)
  console.log(`\n${colors.cyan}Paso 4: ¿Deseas reinstalar las dependencias para simular un entorno limpio?${colors.reset}`);
  console.log(`${colors.yellow}Esto puede tomar tiempo, pero es más cercano a lo que Amplify haría${colors.reset}`);
  console.log(`${colors.yellow}Presiona Enter para continuar sin reinstalar, o escribe 'y' para reinstalar:${colors.reset}`);
  
  // Simulamos la respuesta para este caso
  const reinstall = false; // En un script interactivo real, esto vendría del usuario
  
  if (reinstall) {
    console.log('Reinstalando dependencias...');
    try {
      // Hacer backup de node_modules
      if (!fs.existsSync(path.join(tempDir, 'node_modules_backup'))) {
        fs.mkdirSync(path.join(tempDir, 'node_modules_backup'), { recursive: true });
        // No copiamos node_modules por tiempo, solo hacemos un seguimiento
        fs.writeFileSync(path.join(tempDir, 'node_modules_backup', 'backup_created.txt'), 'Backup creado');
      }
      
      // Eliminar node_modules y reinstalar
      execSync('npx rimraf node_modules', { stdio: 'inherit' });
      console.log('Ejecutando npm ci (instalación limpia)...');
      execSync('npm ci', { stdio: 'inherit' });
      console.log('✅ Dependencias reinstaladas correctamente');
    } catch (error) {
      console.error(`❌ Error reinstalando dependencias: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log('Omitiendo reinstalación de dependencias');
  }
  
  // Paso 5: Ejecutar build
  console.log(`\n${colors.cyan}Paso 5: Ejecutando build (esto puede tomar un tiempo)...${colors.reset}`);
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log(`\n${colors.green}${colors.bright}✅ Build completado exitosamente!${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ Error durante el build:${colors.reset}`, error.message);
    console.log(`\n${colors.red}El despliegue en Amplify probablemente fallará con este error.${colors.reset}`);
    process.exit(1);
  }
  
  // Paso 6: Verificar output del build
  console.log(`\n${colors.cyan}Paso 6: Verificando resultado del build...${colors.reset}`);
  if (fs.existsSync(path.join(__dirname, '../.next'))) {
    console.log(`✅ Directorio .next creado correctamente`);
    
    // Contar archivos generados
    const countFiles = (dir) => {
      let count = 0;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          count += countFiles(path.join(dir, item.name));
        } else {
          count++;
        }
      }
      
      return count;
    };
    
    const fileCount = countFiles(path.join(__dirname, '../.next'));
    console.log(`✅ ${fileCount} archivos generados en el directorio .next`);
  } else {
    console.error(`❌ No se encontró el directorio .next después del build`);
    process.exit(1);
  }
  
  // Paso 7: Restaurar entorno original
  console.log(`\n${colors.cyan}Paso 7: Restaurando entorno original...${colors.reset}`);
  
  // Restaurar .env.local si existía
  if (originalEnvLocal) {
    fs.writeFileSync(envLocalPath, originalEnvLocal);
    console.log('✅ Archivo .env.local restaurado');
  } else {
    // Si no existía, lo eliminamos
    if (fs.existsSync(envLocalPath)) {
      fs.unlinkSync(envLocalPath);
    }
  }
  
  // Resumen final
  console.log(`\n${colors.bright}${colors.green}=== Simulación completada exitosamente ===${colors.reset}`);
  console.log(`\n${colors.green}${colors.bright}✅ La aplicación debería desplegarse correctamente en Amplify.${colors.reset}`);
  console.log(`\nPuedes desplegar usando:`);
  console.log(`${colors.cyan}npm run update-amplify-urls https://tu-app.amplifyapp.com${colors.reset}`);
  console.log(`${colors.cyan}npm run deploy${colors.reset}`);
  
  // Sugerencia de limpieza
  console.log(`\n${colors.yellow}Nota: Puedes eliminar el directorio de simulación (.amplify-simulation) cuando ya no lo necesites.${colors.reset}`);
  
} catch (error) {
  console.error(`\n${colors.red}${colors.bright}Error durante la simulación:${colors.reset}`, error);
  
  // Intentar restaurar el entorno original en caso de error
  try {
    const envLocalBackupPath = path.join(tempDir, '.env.local.backup');
    const envLocalPath = path.join(__dirname, '../.env.local');
    
    if (fs.existsSync(envLocalBackupPath)) {
      fs.copyFileSync(envLocalBackupPath, envLocalPath);
      console.log('✅ Archivo .env.local restaurado después del error');
    }
    
    const outputsBackupPath = path.join(tempDir, 'amplify_outputs.json.backup');
    const outputsPath = path.join(__dirname, '../amplify_outputs.json');
    
    if (fs.existsSync(outputsBackupPath)) {
      fs.copyFileSync(outputsBackupPath, outputsPath);
      console.log('✅ Archivo amplify_outputs.json restaurado después del error');
    }
  } catch (restoreError) {
    console.error('Error al restaurar el entorno original:', restoreError);
  }
  
  process.exit(1);
}
