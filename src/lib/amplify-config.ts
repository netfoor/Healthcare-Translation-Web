import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

let isConfigured = false;

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
      // Validate that we have the required configuration
      if (!outputs.auth?.user_pool_id || !outputs.data?.url) {
        throw new Error('Invalid Amplify configuration - missing required fields');
      }

      Amplify.configure(outputs, {
        ssr: true // Enable SSR support
      });
      
      isConfigured = true;
      console.log('Amplify configured successfully');
    }
  } catch (error) {
    console.error('Failed to configure Amplify:', error);
    throw error; // Re-throw to handle in the provider
  }
}

/**
 * Check if Amplify is configured
 */
export function isAmplifyConfigured(): boolean {
  return isConfigured;
}