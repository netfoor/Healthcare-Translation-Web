import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('WebSocket Disconnect event:', JSON.stringify(event, null, 2));
  
  const connectionId = event.requestContext.connectionId!;
  const timestamp = new Date().toISOString();
  
  try {
    // Update connection status to disconnected before deletion for audit trail
    await dynamodb.send(new UpdateItemCommand({
      TableName: process.env.CONNECTIONS_TABLE!,
      Key: {
        connectionId: { S: connectionId }
      },
      UpdateExpression: 'SET #status = :status, disconnectedAt = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': { S: 'disconnected' },
        ':timestamp': { S: timestamp }
      }
    }));
    
    // Clean up any active sessions for this connection
    // This would involve querying for active sessions and cleaning them up
    // For now, we'll just log the cleanup action
    console.log(`Cleaning up sessions for connection ${connectionId}`);
    
    console.log(`Connection ${connectionId} marked as disconnected`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Disconnected successfully',
        connectionId,
        timestamp 
      })
    };
  } catch (error) {
    console.error('Disconnect error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Failed to disconnect cleanly',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};