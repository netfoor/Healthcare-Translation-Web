# Healthcare Translation WebSocket Infrastructure

This CDK project creates the WebSocket API infrastructure for the Healthcare Translation App.

## Architecture

The infrastructure includes:

- **WebSocket API Gateway**: Handles real-time bidirectional communication
- **Lambda Functions**: 
  - Connect Handler: Manages new WebSocket connections
  - Disconnect Handler: Cleans up disconnected connections
  - Message Handler: Processes real-time messages (audio, translation, etc.)
- **DynamoDB Tables**:
  - Connections Table: Stores active WebSocket connections
  - Sessions Table: Manages translation sessions and state

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+ installed
3. CDK CLI installed (`npm install -g aws-cdk`)

### Deploy the Stack

```bash
# Install dependencies
npm install

# Build Lambda functions
npm run build-lambdas

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the stack
npm run deploy
```

### Development Commands

```bash
# Build TypeScript
npm run build

# Build Lambda functions
npm run build-lambdas

# Synthesize CloudFormation template
npm run synth

# Show differences
npm run diff

# Destroy the stack
npm run destroy
```

## Outputs

After deployment, the stack provides:

- `WebSocketURL`: The WebSocket endpoint URL for client connections
- `WebSocketApiId`: The API Gateway WebSocket API ID
- `ConnectionsTableName`: DynamoDB table for connection management
- `SessionsTableName`: DynamoDB table for session management

## Security Features

- IAM roles with least privilege access
- DynamoDB encryption at rest
- CloudWatch logging for all Lambda functions
- TTL-based automatic cleanup of old records

## Lambda Functions

### Connect Handler
- Stores new connection information in DynamoDB
- Validates connection requests
- Sets up connection metadata

### Disconnect Handler
- Cleans up connection records
- Handles graceful disconnection
- Manages session cleanup

### Message Handler
- Processes real-time messages
- Handles audio streaming
- Manages translation requests
- Supports speech synthesis
- Implements session management

## Message Protocol

The WebSocket API supports the following message types:

```json
{
  "action": "startTranscription",
  "data": {
    "inputLanguage": "en-US",
    "outputLanguage": "es-ES",
    "medicalSpecialty": "cardiology"
  },
  "sessionId": "optional-session-id",
  "requestId": "optional-request-id"
}
```

Supported actions:
- `startTranscription`: Begin a new transcription session
- `audioChunk`: Send audio data for processing
- `stopTranscription`: End the current session
- `translate`: Request text translation
- `synthesizeSpeech`: Convert text to speech
- `ping`: Health check

## Monitoring

- CloudWatch Logs for all Lambda functions
- DynamoDB metrics for table performance
- API Gateway metrics for WebSocket connections
- Custom metrics for session management

## Cost Optimization

- Pay-per-request DynamoDB billing
- Automatic TTL cleanup of old records
- Efficient Lambda memory allocation
- Connection-based scaling