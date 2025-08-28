import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

/**
 * Healthcare Translation App Backend Configuration
 * Includes authentication, data storage, and file storage with encryption
 */
defineBackend({
  auth,
  data,
  storage,
});
