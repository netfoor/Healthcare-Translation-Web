import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('WebSocket Connect event:', JSON.stringify(event, null, 2));
  
  const connectionId = event.requestContext.connectionId!;
  const timestamp = new Date().toISOString();
  
  try {
    // Store connection information in DynamoDB
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.CONNECTIONS_TABLE!,
      Item: {
        connectionId: { S: connectionId },
        timestamp: { S: timestamp },
        status: { S: 'connected' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) }, // 24 hours TTL
        userAgent: { S: event.requestContext.identity?.userAgent || 'unknown' },
        sourceIp: { S: event.requestContext.identity?.sourceIp || 'unknown' },
      }
    }));
    
    console.log(`Connection ${connectionId} stored successfully`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Connected successfully',
        connectionId,
        timestamp 
      })
    };
  } catch (error) {
    console.error('Connection error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};