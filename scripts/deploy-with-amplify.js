#!/usr/bin/env node

/**
 * Deploy script with Amplify URL support
 * 
 * Este script carga las variables de entorno desde .env.amplify
 * antes de ejecutar el despliegue
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ruta al archivo .env.amplify
const envFilePath = path.join(__dirname, '../.env.amplify');

try {
  console.log('🔄 Ejecutando despliegue con configuración de Amplify...');

  // Verificar si existe el archivo .env.amplify
  if (fs.existsSync(envFilePath)) {
    console.log('📄 Encontrado archivo .env.amplify');
    
    // Leer el contenido del archivo
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Extraer la URL de Amplify
    const match = envContent.match(/AMPLIFY_APP_URL=(.+)/);
    if (match && match[1]) {
      const amplifyUrl = match[1].trim();
      console.log(`🌐 URL de Amplify encontrada: ${amplifyUrl}`);
      
      // Configurar la variable de entorno
      process.env.AMPLIFY_APP_URL = amplifyUrl;
      console.log('✅ Variable de entorno AMPLIFY_APP_URL configurada');
    } else {
      console.warn('⚠️ No se encontró AMPLIFY_APP_URL en .env.amplify');
    }
  } else {
    console.warn('⚠️ No se encontró archivo .env.amplify');
  }
  
  // Verificar si la variable está configurada
  if (process.env.AMPLIFY_APP_URL) {
    console.log(`🔗 Usando URL de Amplify: ${process.env.AMPLIFY_APP_URL}`);
  } else {
    console.warn('⚠️ No se ha configurado AMPLIFY_APP_URL. Las URLs de autenticación usarán valores vacíos.');
    console.warn('Ejecuta: npm run update-amplify-urls https://tu-app.amplifyapp.com');
  }
  
  // Ejecutar el despliegue
  console.log('🚀 Ejecutando despliegue...');
  
  // Comando basado en la plataforma
  if (process.platform === 'win32') {
    execSync('cd cdk && npm run deploy', { stdio: 'inherit', shell: 'powershell.exe' });
  } else {
    execSync('cd cdk && npm run deploy', { stdio: 'inherit', shell: '/bin/bash' });
  }
  
  console.log('✅ Despliegue completado con éxito!');
} catch (error) {
  console.error('❌ Error durante el despliegue:', error.message);
  process.exit(1);
}
