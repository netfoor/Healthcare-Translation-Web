#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebSocketStack } from '../lib/websocket-stack';

const app = new cdk.App();

new WebSocketStack(app, 'HealthcareTranslationWebSocketStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'WebSocket API infrastructure for Healthcare Translation App',
});