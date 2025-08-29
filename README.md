# Healthcare Translation App

A real-time multilingual translation platform designed to bridge communication gaps between patients and healthcare providers.

## Features

- **Voice-to-Text**: Convert spoken patient input into accurate text transcripts with AI enhancement
- **Real-Time Translation**: Translate patient speech in real-time with medical context awareness
- **Audio Playback**: Play translated text as natural-sounding audio for patients
- **Session Management**: Track and manage translation sessions with secure data handling
- **HIPAA Compliance**: Built with healthcare security and privacy requirements in mind

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript and App Router
- **Backend**: AWS Amplify Gen 2 with serverless architecture
- **Authentication**: AWS Cognito with Hosted UI
- **Database**: DynamoDB for session and transcript storage
- **Storage**: S3 with SSE-KMS encryption for audio files
- **Styling**: Tailwind CSS with responsive design

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable React components
├── lib/                 # Utility functions and configurations
│   ├── types.ts        # TypeScript interfaces
│   ├── aws-utils.ts    # AWS service utilities
│   ├── config.ts       # Configuration management
│   └── amplify-config.ts # Amplify configuration
amplify/                 # AWS Amplify Gen 2 backend
├── auth/               # Authentication configuration
├── data/               # Database schema and API
├── storage/            # File storage configuration
└── backend.ts          # Backend resource definitions
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- AWS account with Amplify access

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd healthcare-translation-app
   npm install
   ```

2. **Deploy the backend**:
   ```bash
   npx ampx sandbox
   ```
   This will deploy your AWS resources and generate the `amplify_outputs.json` configuration file.

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Variables

Copy `.env.local` and configure the following variables:

```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_ENABLE_DEBUG_LOGGING=true
NEXT_PUBLIC_MOCK_SERVICES=false
NEXT_PUBLIC_MAX_AUDIO_DURATION=300
NEXT_PUBLIC_AUDIO_SAMPLE_RATE=16000
NEXT_PUBLIC_SESSION_TIMEOUT=1440
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx ampx sandbox` - Deploy backend in sandbox mode
- `npx ampx generate` - Generate client code from backend

### Backend Development

The backend is configured using AWS Amplify Gen 2:

- **Authentication**: Configured in `amplify/auth/resource.ts`
- **Database**: Schema defined in `amplify/data/resource.ts`
- **Storage**: File storage in `amplify/storage/resource.ts`

To modify the backend, update the resource files and redeploy:

```bash
npx ampx sandbox
```

## Security & Compliance

This application is designed with healthcare security requirements:

- **Data Encryption**: All data encrypted at rest and in transit
- **Access Control**: Role-based access with AWS Cognito
- **Audit Logging**: Comprehensive logging for compliance
- **PII Protection**: Automatic sanitization of sensitive data in logs
- **Session Management**: Secure session handling with timeouts

## Deployment

### Production Deployment

1. **Deploy backend to production**:
   ```bash
   npx ampx pipeline-deploy --branch main
   ```

2. **Deploy frontend**:
   The application can be deployed to Vercel, AWS Amplify Hosting, or any Next.js-compatible platform.

### Environment Configuration

Ensure production environment variables are configured for:
- AWS service endpoints
- Security settings
- Feature flags

## Contributing

1. Follow the established code structure and naming conventions
2. Ensure all TypeScript interfaces are properly defined
3. Add appropriate error handling and logging
4. Test with both mock and real AWS services
5. Maintain HIPAA compliance in all code changes

## Support

For issues and questions:
- Check the AWS Amplify documentation
- Review the Next.js documentation
- Ensure AWS permissions are correctly configured