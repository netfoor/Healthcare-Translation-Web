import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

/**
 * Configure Amplify for the healthcare translation app
 * This configuration will be generated after running `npx ampx sandbox`
 */
export function configureAmplify() {
  try {
    Amplify.configure(outputs);
  } catch {
    console.warn('Amplify configuration not found. Run `npx ampx sandbox` to generate configuration.');
  }
}