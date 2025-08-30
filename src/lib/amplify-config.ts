import { Amplify } from 'aws-amplify';

let isConfigured = false;

// Define un tipo para las salidas de Amplify
type AmplifyOutputs = {
  auth?: {
    user_pool_id: string;
    identity_pool_id?: string;
    web_client_id?: string;
    oauth?: {
      domain?: string;
      scope?: string[];
      redirectSignIn?: string[];
      redirectSignOut?: string[];
      responseType?: string;
    };
  };
  data?: {
    url: string;
    region?: string;
  };
  // Otros campos que puedan existir
  [key: string]: unknown;
};

// Intenta importar el archivo de configuración, pero maneja su ausencia
let outputs: AmplifyOutputs = {};
try {
  // Intentamos importar dinámicamente el archivo solo en tiempo de ejecución
  if (typeof window !== 'undefined') {
    // Estamos en el cliente, intentar cargar la configuración
    try {
      // @ts-expect-error - Este import puede fallar durante el build pero es intencional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const importedOutputs = require('../../amplify_outputs.json');
      outputs = importedOutputs;
    } catch (error) {
      console.warn('amplify_outputs.json no encontrado. Amplify no será configurado automáticamente.');
    }
  }
} catch (error) {
  console.warn('Error al importar amplify_outputs.json:', error);
}

/**
 * Configure Amplify for the healthcare translation app
 * This configuration will be generated after running `npx ampx sandbox`
 */
export function configureAmplify() {
  // Prevent multiple configurations
  if (isConfigured) {
    return;
  }

  try {
    // Only configure on client side
    if (typeof window !== 'undefined') {
      // Verificar si tenemos las salidas de Amplify
      if (!outputs || Object.keys(outputs).length === 0) {
        console.warn('No se encontró configuración de Amplify. La autenticación y otros servicios pueden no funcionar correctamente.');
        return; // No configuramos Amplify, pero tampoco fallamos
      }

      // Validate that we have the required configuration
      if (!outputs.auth?.user_pool_id || !outputs.data?.url) {
        console.warn('Configuración de Amplify incompleta - faltan campos requeridos');
        return; // No configuramos Amplify, pero tampoco fallamos
      }

      Amplify.configure(outputs, {
        ssr: true // Enable SSR support
      });
      
      isConfigured = true;
      console.log('Amplify configured successfully');
    }
  } catch (error) {
    console.error('Failed to configure Amplify:', error);
    // No relanzamos el error para evitar que falle la aplicación
  }
}

/**
 * Check if Amplify is configured
 */
export function isAmplifyConfigured(): boolean {
  return isConfigured;
}

/**
 * Create mock amplify_outputs.json file for development/build purposes
 * This function is útil para crear un archivo de configuración temporal
 * que permita que el build funcione incluso sin una configuración real de Amplify
 */
export function createMockAmplifyOutputs(outputPath = './amplify_outputs.json'): void {
  if (typeof window === 'undefined') {
    // Solo ejecutar en un entorno Node.js (no en el navegador)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    
    const mockOutputs: AmplifyOutputs = {
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
    
    const fullPath = path.resolve(outputPath);
    const dirPath = path.dirname(fullPath);
    
    // Asegurarnos de que el directorio existe
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, JSON.stringify(mockOutputs, null, 2));
    console.log(`Mock Amplify outputs file created at: ${fullPath}`);
  }
}