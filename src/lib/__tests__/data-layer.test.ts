/**
 * Unit tests for DataLayer
 * Tests DynamoDB operations, error handling, and retry logic
 */

import { DataLayer } from '../data-layer';
import { TranslationSession, TranscriptEntry, AudioMetadata } from '../types';

// Mock AWS Amplify
const mockClient = {
  models: {
    TranslationSession: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
    },
    TranscriptEntry: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
    },
    AudioMetadata: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
    },
  },
};

jest.mock('aws-amplify/data', () => ({
  generateClient: jest.fn(() => mockClient),
}));

jest.mock('aws-amplify/auth', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve({ userId: 'test-user-123' })),
}));

describe('DataLayer', () => {
  let dataLayer: DataLayer;

  beforeEach(() => {
    dataLayer = DataLayer.getInstance();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Session Operations', () => {
    const mockSessionData = {
      userId: 'test-user-123',
      inputLanguage: 'en',
      outputLanguage: 'es',
      status: 'active' as const,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    describe('createSession', () => {
      it('should create a session successfully', async () => {
        const mockCreatedSession = {
          id: 'session_123',
          ...mockSessionData,
          createdAt: mockSessionData.createdAt.toISOString(),
          lastActivity: mockSessionData.lastActivity.toISOString(),
        };

        mockClient.models.TranslationSession.create.mockResolvedValue({
          data: mockCreatedSession,
          errors: null,
        });

        const result = await dataLayer.createSession(mockSessionData);

        expect(result).toMatchObject({
          id: 'session_123',
          userId: 'test-user-123',
          inputLanguage: 'en',
          outputLanguage: 'es',
          status: 'active',
        });

        expect(mockClient.models.TranslationSession.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'test-user-123',
            inputLanguage: 'en',
            outputLanguage: 'es',
            status: 'active',
            ttl: expect.any(Number),
          })
        );
      });

      it('should handle creation errors', async () => {
        mockClient.models.TranslationSession.create.mockResolvedValue({
          data: null,
          errors: [{ message: 'Creation failed' }],
        });

        await expect(dataLayer.createSession(mockSessionData)).rejects.toThrow(
          'Failed to create session: Creation failed'
        );
      });

      it('should retry on retryable errors', async () => {
        mockClient.models.TranslationSession.create
          .mockRejectedValueOnce(new Error('NetworkError'))
          .mockResolvedValue({
            data: { id: 'session_123', ...mockSessionData },
            errors: null,
          });

        const result = await dataLayer.createSession(mockSessionData);

        expect(result.id).toBe('session_123');
        expect(mockClient.models.TranslationSession.create).toHaveBeenCalledTimes(2);
      });
    });

    describe('getSession', () => {
      it('should retrieve a session successfully', async () => {
        const mockSession = {
          id: 'session_123',
          ...mockSessionData,
          createdAt: mockSessionData.createdAt.toISOString(),
          lastActivity: mockSessionData.lastActivity.toISOString(),
        };

        mockClient.models.TranslationSession.get.mockResolvedValue({
          data: mockSession,
          errors: null,
        });

        const result = await dataLayer.getSession('session_123');

        expect(result).toMatchObject({
          id: 'session_123',
          userId: 'test-user-123',
          inputLanguage: 'en',
          outputLanguage: 'es',
        });
      });

      it('should return null for non-existent session', async () => {
        mockClient.models.TranslationSession.get.mockResolvedValue({
          data: null,
          errors: null,
        });

        const result = await dataLayer.getSession('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('updateSession', () => {
      it('should update a session successfully', async () => {
        const mockUpdatedSession = {
          id: 'session_123',
          ...mockSessionData,
          status: 'paused',
          createdAt: mockSessionData.createdAt.toISOString(),
          lastActivity: new Date().toISOString(),
        };

        mockClient.models.TranslationSession.update.mockResolvedValue({
          data: mockUpdatedSession,
          errors: null,
        });

        const result = await dataLayer.updateSession('session_123', { status: 'paused' });

        expect(result.status).toBe('paused');
        expect(mockClient.models.TranslationSession.update).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'session_123',
            status: 'paused',
            ttl: expect.any(Number),
          })
        );
      });
    });

    describe('listUserSessions', () => {
      it('should list user sessions with filtering', async () => {
        const mockSessions = [
          {
            id: 'session_1',
            ...mockSessionData,
            createdAt: mockSessionData.createdAt.toISOString(),
            lastActivity: mockSessionData.lastActivity.toISOString(),
          },
          {
            id: 'session_2',
            ...mockSessionData,
            status: 'ended',
            createdAt: mockSessionData.createdAt.toISOString(),
            lastActivity: mockSessionData.lastActivity.toISOString(),
          },
        ];

        mockClient.models.TranslationSession.list.mockResolvedValue({
          data: mockSessions,
          errors: null,
          nextToken: null,
        });

        const result = await dataLayer.listUserSessions('test-user-123', {
          limit: 10,
          status: 'active',
        });

        expect(result.sessions).toHaveLength(2);
        expect(mockClient.models.TranslationSession.list).toHaveBeenCalledWith({
          filter: { userId: { eq: 'test-user-123' }, status: { eq: 'active' } },
          limit: 10,
          nextToken: undefined,
        });
      });
    });

    describe('deleteSession', () => {
      it('should delete a session and related data', async () => {
        // Mock transcript and audio metadata deletion
        mockClient.models.TranscriptEntry.list.mockResolvedValue({
          data: [{ id: 'transcript_1' }],
          errors: null,
        });
        mockClient.models.AudioMetadata.list.mockResolvedValue({
          data: [{ id: 'audio_1' }],
          errors: null,
        });
        mockClient.models.TranscriptEntry.delete.mockResolvedValue({ errors: null });
        mockClient.models.AudioMetadata.delete.mockResolvedValue({ errors: null });
        mockClient.models.TranslationSession.delete.mockResolvedValue({ errors: null });

        await dataLayer.deleteSession('session_123');

        expect(mockClient.models.TranslationSession.delete).toHaveBeenCalledWith({
          id: 'session_123',
        });
      });
    });
  });

  describe('Transcript Operations', () => {
    const mockTranscriptData = {
      sessionId: 'session_123',
      originalText: 'Hello world',
      confidence: 0.95,
      timestamp: new Date(),
      speaker: 'user',
      isProcessing: false,
    };

    describe('createTranscriptEntry', () => {
      it('should create a transcript entry successfully', async () => {
        const mockCreatedEntry = {
          id: 'transcript_123',
          ...mockTranscriptData,
          timestamp: mockTranscriptData.timestamp.toISOString(),
        };

        mockClient.models.TranscriptEntry.create.mockResolvedValue({
          data: mockCreatedEntry,
          errors: null,
        });

        const result = await dataLayer.createTranscriptEntry(mockTranscriptData);

        expect(result).toMatchObject({
          id: 'transcript_123',
          sessionId: 'session_123',
          originalText: 'Hello world',
          confidence: 0.95,
        });
      });
    });

    describe('updateTranscriptEntry', () => {
      it('should update a transcript entry successfully', async () => {
        const mockUpdatedEntry = {
          id: 'transcript_123',
          ...mockTranscriptData,
          translatedText: 'Hola mundo',
          timestamp: mockTranscriptData.timestamp.toISOString(),
        };

        mockClient.models.TranscriptEntry.update.mockResolvedValue({
          data: mockUpdatedEntry,
          errors: null,
        });

        const result = await dataLayer.updateTranscriptEntry('transcript_123', {
          translatedText: 'Hola mundo',
        });

        expect(result.translatedText).toBe('Hola mundo');
      });
    });

    describe('getSessionTranscripts', () => {
      it('should retrieve session transcripts with pagination', async () => {
        const mockTranscripts = [
          {
            id: 'transcript_1',
            ...mockTranscriptData,
            timestamp: mockTranscriptData.timestamp.toISOString(),
          },
          {
            id: 'transcript_2',
            ...mockTranscriptData,
            timestamp: mockTranscriptData.timestamp.toISOString(),
          },
        ];

        mockClient.models.TranscriptEntry.list.mockResolvedValue({
          data: mockTranscripts,
          errors: null,
          nextToken: 'next_token_123',
        });

        const result = await dataLayer.getSessionTranscripts('session_123', {
          limit: 50,
        });

        expect(result.entries).toHaveLength(2);
        expect(result.nextToken).toBe('next_token_123');
      });
    });
  });

  describe('Audio Metadata Operations', () => {
    const mockAudioData = {
      sessionId: 'session_123',
      s3Key: 'audio-files/user/session/audio.wav',
      duration: 30.5,
      format: 'audio/wav',
      language: 'en',
      createdAt: new Date(),
    };

    describe('createAudioMetadata', () => {
      it('should create audio metadata successfully', async () => {
        const mockCreatedMetadata = {
          id: 'audio_123',
          ...mockAudioData,
          createdAt: mockAudioData.createdAt.toISOString(),
        };

        mockClient.models.AudioMetadata.create.mockResolvedValue({
          data: mockCreatedMetadata,
          errors: null,
        });

        const result = await dataLayer.createAudioMetadata(mockAudioData);

        expect(result).toMatchObject({
          id: 'audio_123',
          sessionId: 'session_123',
          s3Key: 'audio-files/user/session/audio.wav',
          duration: 30.5,
        });
      });
    });

    describe('getSessionAudioMetadata', () => {
      it('should retrieve session audio metadata', async () => {
        const mockAudioMetadata = [
          {
            id: 'audio_1',
            ...mockAudioData,
            createdAt: mockAudioData.createdAt.toISOString(),
          },
        ];

        mockClient.models.AudioMetadata.list.mockResolvedValue({
          data: mockAudioMetadata,
          errors: null,
        });

        const result = await dataLayer.getSessionAudioMetadata('session_123');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('audio_1');
      });
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry operations on retryable errors', async () => {
      const mockSessionData = {
        userId: 'test-user-123',
        inputLanguage: 'en',
        outputLanguage: 'es',
        status: 'active' as const,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockClient.models.TranslationSession.create
        .mockRejectedValueOnce(new Error('ThrottlingException'))
        .mockRejectedValueOnce(new Error('ServiceUnavailableException'))
        .mockResolvedValue({
          data: { id: 'session_123', ...mockSessionData },
          errors: null,
        });

      const result = await dataLayer.createSession(mockSessionData);

      expect(result.id).toBe('session_123');
      expect(mockClient.models.TranslationSession.create).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockSessionData = {
        userId: 'test-user-123',
        inputLanguage: 'en',
        outputLanguage: 'es',
        status: 'active' as const,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockClient.models.TranslationSession.create.mockRejectedValue(
        new Error('ValidationException')
      );

      await expect(dataLayer.createSession(mockSessionData)).rejects.toThrow();
      expect(mockClient.models.TranslationSession.create).toHaveBeenCalledTimes(3); // Max retries
    });

    it('should create service errors with proper structure', async () => {
      const mockSessionData = {
        userId: 'test-user-123',
        inputLanguage: 'en',
        outputLanguage: 'es',
        status: 'active' as const,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockClient.models.TranslationSession.create.mockRejectedValue(
        new Error('Test error')
      );

      try {
        await dataLayer.createSession(mockSessionData);
      } catch (error: any) {
        expect(error.code).toBe('CREATE_SESSION_FAILED');
        expect(error.service).toBe('DynamoDB');
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(typeof error.retryable).toBe('boolean');
      }
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when operations succeed', async () => {
      mockClient.models.TranslationSession.list.mockResolvedValue({
        data: [],
        errors: null,
      });

      const result = await dataLayer.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('DynamoDB connection healthy');
    });

    it('should return unhealthy status when operations fail', async () => {
      mockClient.models.TranslationSession.list.mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await dataLayer.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('DynamoDB connection failed');
    });
  });

  describe('TTL Management', () => {
    it('should set TTL for session creation', async () => {
      const mockSessionData = {
        userId: 'test-user-123',
        inputLanguage: 'en',
        outputLanguage: 'es',
        status: 'active' as const,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockClient.models.TranslationSession.create.mockResolvedValue({
        data: { id: 'session_123', ...mockSessionData },
        errors: null,
      });

      await dataLayer.createSession(mockSessionData);

      const createCall = mockClient.models.TranslationSession.create.mock.calls[0][0];
      expect(createCall.ttl).toBeDefined();
      expect(typeof createCall.ttl).toBe('number');
      
      // TTL should be approximately 24 hours from now (in seconds)
      const expectedTTL = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
      expect(createCall.ttl).toBeCloseTo(expectedTTL, -2); // Within 100 seconds
    });

    it('should refresh TTL on session update', async () => {
      mockClient.models.TranslationSession.update.mockResolvedValue({
        data: { id: 'session_123', status: 'paused' },
        errors: null,
      });

      await dataLayer.updateSession('session_123', { status: 'paused' });

      const updateCall = mockClient.models.TranslationSession.update.mock.calls[0][0];
      expect(updateCall.ttl).toBeDefined();
      expect(typeof updateCall.ttl).toBe('number');
    });
  });
});