#!/usr/bin/env node

/**
 * Update Amplify Auth URLs Script
 * 
 * Este script actualiza automáticamente la variable de entorno AMPLIFY_APP_URL
 * para ser utilizada durante el despliegue de Amplify.
 * 
 * Úsalo durante el despliegue o cuando necesites cambiar la URL de Amplify.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Obtén la URL de Amplify del argumento de línea de comandos
const AMPLIFY_APP_URL = process.argv[2];

if (!AMPLIFY_APP_URL) {
  console.error('Error: No se proporcionó la URL de Amplify');
  console.error('Uso: node update-amplify-urls.js https://tu-app.amplifyapp.com');
  process.exit(1);
}

console.log(`Configurando URL de Amplify: ${AMPLIFY_APP_URL}`);

try {
  // Validar la URL
  try {
    new URL(AMPLIFY_APP_URL);
  } catch (e) {
    console.error('Error: La URL proporcionada no es válida');
    process.exit(1);
  }
  
  console.log('✅ URL válida');
  
  // Crear o actualizar el archivo .env.amplify
  const envFilePath = path.join(__dirname, '..', '.env.amplify');
  fs.writeFileSync(envFilePath, `AMPLIFY_APP_URL=${AMPLIFY_APP_URL}\n`, 'utf8');
  console.log(`✅ Archivo .env.amplify creado/actualizado en: ${envFilePath}`);
  
  // Intentar configurar la variable en el entorno actual
  if (process.platform === 'win32') {
    // Windows (PowerShell)
    console.log('Configurando variable de entorno para la sesión actual (Windows)...');
    try {
      execSync(`$env:AMPLIFY_APP_URL="${AMPLIFY_APP_URL}"`, { shell: 'powershell.exe' });
      console.log('✅ Variable de entorno configurada para PowerShell');
    } catch (error) {
      console.warn('⚠️ No se pudo configurar la variable de entorno para PowerShell:', error.message);
    }
  } else {
    // macOS/Linux
    console.log('Configurando variable de entorno para la sesión actual (Unix)...');
    try {
      execSync(`export AMPLIFY_APP_URL="${AMPLIFY_APP_URL}"`, { shell: '/bin/bash' });
      console.log('✅ Variable de entorno configurada para bash');
    } catch (error) {
      console.warn('⚠️ No se pudo configurar la variable de entorno para bash:', error.message);
    }
  }
  
  console.log('\n📋 Instrucciones para desplegar:');
  console.log('1. Asegúrate de que la variable de entorno esté disponible durante el despliegue:');
  
  if (process.platform === 'win32') {
    console.log(`   $env:AMPLIFY_APP_URL="${AMPLIFY_APP_URL}"`);
    console.log('   npm run deploy');
  } else {
    console.log(`   export AMPLIFY_APP_URL="${AMPLIFY_APP_URL}"`);
    console.log('   npm run deploy');
  }
  
  console.log('\n2. Alternativamente, puedes usar el comando en una sola línea:');
  
  if (process.platform === 'win32') {
    console.log(`   $env:AMPLIFY_APP_URL="${AMPLIFY_APP_URL}"; npm run deploy`);
  } else {
    console.log(`   AMPLIFY_APP_URL="${AMPLIFY_APP_URL}" npm run deploy`);
  }
  
  console.log('\n✅ Configuración completada con éxito!');
  
} catch (error) {
  console.error('❌ Error al configurar la URL de Amplify:', error.message);
  process.exit(1);
}
