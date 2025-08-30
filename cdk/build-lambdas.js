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

// Lambda directories to build
const lambdaDirs = [
  'lambda/connect',
  'lambda/disconnect', 
  'lambda/message',
  'lambda/transcribe-medical',
  'lambda/medical-vocabulary',
  'lambda/service-monitor',
  'lambda/bedrock-ai',
  'lambda/translation',
  'lambda/polly-tts'
];

// Verificar modo rápido
const fastMode = process.argv.includes('--fast');
const validateOnly = process.argv.includes('--validate');

console.log(`${colors.bright}${colors.blue}=== Construyendo funciones Lambda ===${colors.reset}`);
if (fastMode) {
  console.log(`${colors.yellow}Modo rápido activado: Omitiendo la instalación de dependencias${colors.reset}`);
}
if (validateOnly) {
  console.log(`${colors.yellow}Modo validación: Solo verificando la estructura, sin construir${colors.reset}`);
}

let errors = 0;
let warnings = 0;
let success = 0;

// Verificar dependencias globales
console.log(`\n${colors.cyan}Verificando dependencias globales...${colors.reset}`);
const rootPackageJson = path.join(__dirname, 'package.json');
if (fs.existsSync(rootPackageJson)) {
  try {
    const packageData = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
    
    const requiredDeps = [
      '@aws-sdk/client-apigatewaymanagementapi',
      '@aws-sdk/client-bedrock-runtime',
      '@aws-sdk/client-dynamodb',
      '@aws-sdk/client-transcribe',
      '@aws-sdk/client-translate',
      '@aws-sdk/client-polly'
    ];
    
    const missingDeps = requiredDeps.filter(dep => !deps[dep]);
    
    if (missingDeps.length > 0) {
      console.log(`${colors.yellow}⚠️ Faltan dependencias importantes en package.json:${colors.reset}`);
      missingDeps.forEach(dep => {
        console.log(`   ${colors.yellow}${dep}${colors.reset}`);
      });
      warnings += missingDeps.length;
    } else {
      console.log(`${colors.green}✅ Todas las dependencias críticas están presentes${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error al leer package.json:${colors.reset}`, error.message);
    errors++;
  }
} else {
  console.error(`${colors.red}❌ No se encontró package.json en el directorio CDK${colors.reset}`);
  errors++;
}

console.log(`\n${colors.cyan}Verificando funciones Lambda...${colors.reset}`);

// Ejecutar en paralelo para mayor velocidad
const promises = lambdaDirs.map(dir => {
  return new Promise((resolve) => {
    const fullPath = path.join(__dirname, dir);
    
    if (fs.existsSync(fullPath)) {
      // Verificar archivos críticos
      const indexFile = path.join(fullPath, 'index.ts');
      if (!fs.existsSync(indexFile)) {
        console.log(`${colors.red}❌ ${dir}: No se encontró index.ts${colors.reset}`);
        errors++;
        return resolve();
      }
      
      // Si es solo validación, no construir
      if (validateOnly) {
        console.log(`${colors.green}✓ ${dir}: Estructura válida${colors.reset}`);
        success++;
        return resolve();
      }
      
      // Check if there's a package.json in the lambda directory
      const packageJsonPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          if (!fastMode) {
            // Modo normal: instalar dependencias
            console.log(`${colors.cyan}Construyendo ${dir}...${colors.reset}`);
            execSync('npm install', { cwd: fullPath, stdio: 'pipe' });
          }
          console.log(`${colors.green}✓ ${dir}${colors.reset}`);
          success++;
          resolve();
        } catch (error) {
          console.error(`${colors.red}❌ ${dir}: ${error.message}${colors.reset}`);
          errors++;
          resolve();
        }
      } else {
        // No tiene package.json propio
        console.log(`${colors.green}✓ ${dir} (usando dependencias principales)${colors.reset}`);
        success++;
        resolve();
      }
    } else {
      console.log(`${colors.yellow}⚠️ ${dir}: Directorio no encontrado${colors.reset}`);
      warnings++;
      resolve();
    }
  });
});

// Esperar a que todas las funciones terminen
Promise.all(promises).then(() => {
  console.log(`\n${colors.bright}${colors.blue}=== Resumen de la construcción ===${colors.reset}`);
  console.log(`${colors.green}✅ Éxitos: ${success}${colors.reset}`);
  console.log(`${colors.yellow}⚠️ Advertencias: ${warnings}${colors.reset}`);
  console.log(`${colors.red}❌ Errores: ${errors}${colors.reset}`);
  
  if (errors > 0) {
    console.error(`\n${colors.red}${colors.bright}❌ La construcción falló con ${errors} errores${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}✅ Proceso de construcción completado${colors.reset}`);
    if (warnings > 0) {
      console.log(`${colors.yellow}(con ${warnings} advertencias)${colors.reset}`);
    }
  }
});