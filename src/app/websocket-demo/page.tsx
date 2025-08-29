import { WebSocketDemo } from '../../components/WebSocketDemo';

export default function WebSocketDemoPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            WebSocket Communication Demo
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Test the real-time WebSocket communication layer for the Healthcare Translation App. 
            This demo shows connection management, message handling, and automatic reconnection features.
          </p>
        </div>
        
        <WebSocketDemo />
        
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Features Demonstrated</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Connection Management</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Manual connect/disconnect</li>
                <li>• Automatic reconnection with exponential backoff</li>
                <li>• Connection status indicators</li>
                <li>• Heartbeat/ping functionality</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Message Handling</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Request/response pattern</li>
                <li>• Message queuing during disconnection</li>
                <li>• Event-based message listeners</li>
                <li>• Error handling and timeouts</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Healthcare Features</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Transcription session management</li>
                <li>• Audio chunk streaming simulation</li>
                <li>• Real-time translation requests</li>
                <li>• Medical context handling</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Monitoring</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time connection statistics</li>
                <li>• Message queue monitoring</li>
                <li>• Reconnection attempt tracking</li>
                <li>• Active listener count</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}