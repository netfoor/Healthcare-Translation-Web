import { defineStorage } from '@aws-amplify/backend';

/**
 * Define and configure storage for healthcare translation app
 * S3 storage with SSE-KMS encryption for audio files
 */
export const storage = defineStorage({
  name: 'healthcareTranslationStorage',
  access: (allow) => ({
    'audio-files/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'temp-audio/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});