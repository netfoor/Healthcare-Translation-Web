import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Healthcare Translation App Data Schema
 * Defines models for translation sessions and transcript entries
 */
const schema = a.schema({
  TranslationSession: a
    .model({
      userId: a.string().required(),
      inputLanguage: a.string().required(),
      outputLanguage: a.string().required(),
      status: a.enum(['active', 'paused', 'ended']),
      createdAt: a.datetime(),
      lastActivity: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
    ]),

  TranscriptEntry: a
    .model({
      sessionId: a.id().required(),
      originalText: a.string().required(),
      translatedText: a.string(),
      confidence: a.float(),
      timestamp: a.datetime(),
      speaker: a.string(),
      isProcessing: a.boolean().default(false),
      session: a.belongsTo('TranslationSession', 'sessionId'),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
    ]),

  AudioMetadata: a
    .model({
      sessionId: a.id().required(),
      s3Key: a.string().required(),
      duration: a.float(),
      format: a.string(),
      language: a.string(),
      session: a.belongsTo('TranslationSession', 'sessionId'),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
