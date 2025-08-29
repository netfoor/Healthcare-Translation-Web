import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';

export class WebSocketStack extends cdk.Stack {
  public readonly webSocketApi: apigatewayv2.WebSocketApi;
  public readonly webSocketStage: apigatewayv2.WebSocketStage;
  public readonly connectionsTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables for connection and session management
    this.connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'healthcare-translation-connections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'healthcare-translation-sessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // Add GSI for querying sessions by connection ID
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'ConnectionIdIndex',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create IAM role for Lambda functions with necessary permissions
    const lambdaExecutionRole = new iam.Role(this, 'WebSocketLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for WebSocket Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        WebSocketPolicy: new iam.PolicyDocument({
          statements: [
            // API Gateway management permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'execute-api:ManageConnections',
                'execute-api:Invoke',
              ],
              resources: ['*'], // Will be restricted after API creation
            }),
            // DynamoDB permissions for session management
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: ['*'], // Will be restricted to specific tables
            }),
            // Transcribe permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'transcribe:StartStreamTranscription',
                'transcribe:StartMedicalStreamTranscription',
                'transcribe:CreateVocabulary',
                'transcribe:GetVocabulary',
                'transcribe:ListVocabularies',
                'transcribe:UpdateVocabulary',
                'transcribe:DeleteVocabulary',
              ],
              resources: ['*'],
            }),
            // Bedrock permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: ['*'],
            }),
            // Translate permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'translate:TranslateText',
              ],
              resources: ['*'],
            }),
            // Polly permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'polly:SynthesizeSpeech',
              ],
              resources: ['*'],
            }),
            // S3 permissions for audio storage
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: ['*'], // Will be restricted to specific buckets
            }),
          ],
        }),
      },
    });

    // Create log groups for Lambda functions
    const connectLogGroup = new logs.LogGroup(this, 'ConnectHandlerLogGroup', {
      logGroupName: '/aws/lambda/healthcare-translation-connect',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const disconnectLogGroup = new logs.LogGroup(this, 'DisconnectHandlerLogGroup', {
      logGroupName: '/aws/lambda/healthcare-translation-disconnect',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const messageLogGroup = new logs.LogGroup(this, 'MessageHandlerLogGroup', {
      logGroupName: '/aws/lambda/healthcare-translation-message',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const transcribeMedicalLogGroup = new logs.LogGroup(this, 'TranscribeMedicalHandlerLogGroup', {
      logGroupName: '/aws/lambda/healthcare-translation-transcribe-medical',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const medicalVocabularyLogGroup = new logs.LogGroup(this, 'MedicalVocabularyHandlerLogGroup', {
      logGroupName: '/aws/lambda/healthcare-translation-medical-vocabulary',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const serviceMonitorLogGroup = new logs.LogGroup(this, 'ServiceMonitorHandlerLogGroup', {
      logGroupName: '/aws/lambda/healthcare-translation-service-monitor',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Connection handler Lambda function
    const connectHandler = new lambda.Function(this, 'ConnectHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/connect'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
      },
      logGroup: connectLogGroup,
      timeout: cdk.Duration.seconds(30),
    });

    // Disconnect handler Lambda function
    const disconnectHandler = new lambda.Function(this, 'DisconnectHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/disconnect'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        SESSIONS_TABLE: this.sessionsTable.tableName,
      },
      logGroup: disconnectLogGroup,
      timeout: cdk.Duration.seconds(30),
    });

    // Message handler Lambda function for audio streaming and processing
    const messageHandler = new lambda.Function(this, 'MessageHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/message'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        SESSIONS_TABLE: this.sessionsTable.tableName,
      },
      logGroup: messageLogGroup,
      timeout: cdk.Duration.minutes(5), // Longer timeout for processing
      memorySize: 512, // More memory for audio processing
    });

    // Transcribe Medical handler Lambda function for real-time transcription
    const transcribeMedicalHandler = new lambda.Function(this, 'TranscribeMedicalHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/transcribe-medical'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        SESSIONS_TABLE: this.sessionsTable.tableName,
      },
      logGroup: transcribeMedicalLogGroup,
      timeout: cdk.Duration.minutes(15), // Extended timeout for streaming
      memorySize: 1024, // More memory for real-time processing
    });

    // Medical vocabulary setup Lambda function (for initialization)
    const medicalVocabularyHandler = new lambda.Function(this, 'MedicalVocabularyHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/medical-vocabulary'),
      role: lambdaExecutionRole,
      logGroup: medicalVocabularyLogGroup,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
    });

    // Service health monitoring Lambda function
    const serviceMonitorHandler = new lambda.Function(this, 'ServiceMonitorHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/service-monitor'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        SESSIONS_TABLE: this.sessionsTable.tableName,
      },
      logGroup: serviceMonitorLogGroup,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Create CloudWatch Events rule to run health checks every 5 minutes
    const healthCheckRule = new events.Rule(this, 'HealthCheckRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Periodic health check for Transcribe services',
    });

    // Add the service monitor Lambda as a target
    healthCheckRule.addTarget(new targets.LambdaFunction(serviceMonitorHandler));

    // Create WebSocket API
    this.webSocketApi = new apigatewayv2.WebSocketApi(this, 'HealthcareTranslationWebSocketApi', {
      apiName: 'healthcare-translation-websocket',
      description: 'WebSocket API for real-time healthcare translation with route selection',
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ConnectIntegration', connectHandler),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('DisconnectIntegration', disconnectHandler),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration('MessageIntegration', messageHandler),
      },
    });

    // Add specific routes for Transcribe Medical actions
    const transcribeMedicalIntegration = new WebSocketLambdaIntegration('TranscribeMedicalIntegration', transcribeMedicalHandler);
    
    new apigatewayv2.WebSocketRoute(this, 'StartMedicalTranscriptionRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: 'startMedicalTranscription',
      integration: transcribeMedicalIntegration,
    });

    new apigatewayv2.WebSocketRoute(this, 'ProcessMedicalAudioRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: 'processMedicalAudio',
      integration: transcribeMedicalIntegration,
    });

    new apigatewayv2.WebSocketRoute(this, 'StopMedicalTranscriptionRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: 'stopMedicalTranscription',
      integration: transcribeMedicalIntegration,
    });

    new apigatewayv2.WebSocketRoute(this, 'CheckTranscribeHealthRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: 'checkTranscribeHealth',
      integration: transcribeMedicalIntegration,
    });

    // Create WebSocket stage
    this.webSocketStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Grant DynamoDB permissions to Lambda functions
    this.connectionsTable.grantReadWriteData(connectHandler);
    this.connectionsTable.grantReadWriteData(disconnectHandler);
    this.connectionsTable.grantReadWriteData(messageHandler);
    this.connectionsTable.grantReadWriteData(transcribeMedicalHandler);
    this.sessionsTable.grantReadWriteData(messageHandler);
    this.sessionsTable.grantReadWriteData(disconnectHandler);
    this.sessionsTable.grantReadWriteData(transcribeMedicalHandler);
    this.connectionsTable.grantReadWriteData(serviceMonitorHandler);
    this.sessionsTable.grantReadWriteData(serviceMonitorHandler);

    // Update Lambda execution role with specific API Gateway permissions
    lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/${this.webSocketStage.stageName}/POST/@connections/*`
        ],
      })
    );

    // Output the WebSocket URL
    new cdk.CfnOutput(this, 'WebSocketURL', {
      value: this.webSocketStage.url,
      description: 'WebSocket API URL',
      exportName: 'HealthcareTranslationWebSocketURL',
    });

    // Output the API ID for client configuration
    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.webSocketApi.apiId,
      description: 'WebSocket API ID',
      exportName: 'HealthcareTranslationWebSocketApiId',
    });

    // Output DynamoDB table names for reference
    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: this.connectionsTable.tableName,
      description: 'DynamoDB Connections Table Name',
      exportName: 'HealthcareTranslationConnectionsTable',
    });

    new cdk.CfnOutput(this, 'SessionsTableName', {
      value: this.sessionsTable.tableName,
      description: 'DynamoDB Sessions Table Name',
      exportName: 'HealthcareTranslationSessionsTable',
    });

    // Output table names for reference
    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: this.connectionsTable.tableName,
      description: 'DynamoDB Connections Table Name',
      exportName: 'HealthcareTranslationConnectionsTable',
    });

    new cdk.CfnOutput(this, 'SessionsTableName', {
      value: this.sessionsTable.tableName,
      description: 'DynamoDB Sessions Table Name',
      exportName: 'HealthcareTranslationSessionsTable',
    });
  }
}