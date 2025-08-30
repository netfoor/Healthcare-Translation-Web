#!/usr/bin/env node

/**
 * Asistente de despliegue en Amplify
 * 
 * Este script interactivo guía al usuario a través del proceso de despliegue,
 * validando cada paso para garantizar un despliegue exitoso.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Configurar readline para interacción con el usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Función para preguntar al usuario
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Función para ejecutar comandos
const execCommand = (command, silent = false) => {
  try {
    return execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (error) {
    if (silent) {
      return { error: error.message };
    }
    throw error;
  }
};

// Función principal
async function main() {
  console.log(`${colors.bright}${colors.blue}=== Asistente de Despliegue en Amplify ===${colors.reset}\n`);
  console.log(`${colors.cyan}Este asistente te guiará a través del proceso de despliegue en Amplify.${colors.reset}\n`);
  
  try {
    // Paso 1: Verificar estado del repositorio
    console.log(`${colors.cyan}Paso 1: Verificando estado del repositorio Git...${colors.reset}`);
    
    // Verificar si hay cambios sin confirmar
    const gitStatus = execCommand('git status --porcelain', true);
    if (gitStatus && gitStatus.trim() !== '') {
      console.log(`${colors.yellow}⚠️ Hay cambios sin confirmar en tu repositorio:${colors.reset}`);
      console.log(gitStatus);
      
      const confirmContinue = await question(`${colors.yellow}¿Deseas continuar de todos modos? (s/N): ${colors.reset}`);
      if (confirmContinue.toLowerCase() !== 's') {
        console.log('Proceso cancelado. Confirma tus cambios antes de desplegar.');
        process.exit(0);
      }
    } else {
      console.log(`${colors.green}✅ No hay cambios sin confirmar en el repositorio${colors.reset}`);
    }
    
    // Paso 2: Verificar que la aplicación puede construirse correctamente
    console.log(`\n${colors.cyan}Paso 2: Verificando que la aplicación puede construirse correctamente...${colors.reset}`);
    
    const runCheck = await question(`${colors.yellow}¿Quieres ejecutar la verificación de despliegue? (S/n): ${colors.reset}`);
    if (runCheck.toLowerCase() !== 'n') {
      console.log('Ejecutando verificación de despliegue...');
      execCommand('npm run deploy:check');
      console.log(`${colors.green}✅ Verificación completada${colors.reset}`);
    } else {
      console.log('Omitiendo verificación.');
    }
    
    // Paso 3: Configurar URL de Amplify
    console.log(`\n${colors.cyan}Paso 3: Configurando URL de Amplify...${colors.reset}`);
    
    // Verificar si ya existe .env.amplify
    let amplifyUrl = '';
    const envAmplifyPath = path.join(__dirname, '../.env.amplify');
    
    if (fs.existsSync(envAmplifyPath)) {
      const envContent = fs.readFileSync(envAmplifyPath, 'utf8');
      const match = envContent.match(/AMPLIFY_APP_URL=(.+)/);
      if (match && match[1]) {
        amplifyUrl = match[1].trim();
        console.log(`URL actual de Amplify: ${amplifyUrl}`);
      }
    }
    
    if (amplifyUrl) {
      const changeUrl = await question(`${colors.yellow}¿Deseas cambiar la URL de Amplify? (s/N): ${colors.reset}`);
      if (changeUrl.toLowerCase() === 's') {
        amplifyUrl = await question(`${colors.yellow}Ingresa la nueva URL de Amplify (https://tu-app.amplifyapp.com): ${colors.reset}`);
      }
    } else {
      amplifyUrl = await question(`${colors.yellow}Ingresa la URL de Amplify (https://tu-app.amplifyapp.com): ${colors.reset}`);
    }
    
    if (amplifyUrl) {
      // Validar URL
      try {
        new URL(amplifyUrl);
        console.log(`Actualizando URL de Amplify a: ${amplifyUrl}`);
        execCommand(`npm run update-amplify-urls ${amplifyUrl}`);
      } catch (e) {
        console.error(`${colors.red}❌ La URL proporcionada no es válida${colors.reset}`);
        process.exit(1);
      }
    } else {
      console.log(`${colors.yellow}⚠️ No se proporcionó URL de Amplify. Usando la configuración existente.${colors.reset}`);
    }
    
    // Paso 4: Desplegar
    console.log(`\n${colors.cyan}Paso 4: Listo para desplegar...${colors.reset}`);
    
    const confirmDeploy = await question(`${colors.yellow}¿Estás seguro de que quieres desplegar ahora? (s/N): ${colors.reset}`);
    if (confirmDeploy.toLowerCase() === 's') {
      console.log(`\n${colors.bright}${colors.blue}Iniciando despliegue...${colors.reset}\n`);
      
      try {
        execCommand('npm run deploy');
        console.log(`\n${colors.green}${colors.bright}✅ ¡Despliegue completado con éxito!${colors.reset}`);
      } catch (error) {
        console.error(`\n${colors.red}${colors.bright}❌ Error durante el despliegue:${colors.reset}`, error.message);
        process.exit(1);
      }
    } else {
      console.log('Despliegue cancelado.');
    }
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}Error durante el proceso:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Ejecutar el programa principal
main().catch((error) => {
  console.error(`${colors.red}${colors.bright}Error inesperado:${colors.reset}`, error);
  process.exit(1);
});
