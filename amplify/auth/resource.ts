import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource for healthcare translation app
 * Includes Cognito Hosted UI configuration for healthcare providers
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    // Configure Cognito Hosted UI
    externalProviders: {
      callbackUrls: [
        'http://localhost:3000/',
        'http://localhost:3000/auth/callback',
        'https://main.d19o5jdw6rh2dj.amplifyapp.com/',
        'https://main.d19o5jdw6rh2dj.amplifyapp.com/auth/callback',
      ],
      logoutUrls: [
        'http://localhost:3000/',
        'https://main.d19o5jdw6rh2dj.amplifyapp.com/',
      ],
    },
  },
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true,
    },
    givenName: {
      required: true,
      mutable: true,
    },
    familyName: {
      required: true,
      mutable: true,
    },
    email: {
      required: true,
      mutable: true,
    },
  },
  accountRecovery: 'EMAIL_ONLY',
  // Configure groups for different healthcare roles
  groups: ['HEALTHCARE_PROVIDERS', 'ADMINISTRATORS'],
});
