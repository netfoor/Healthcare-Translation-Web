/**
 * WebSocket Connection Helper Utility
 * 
 * This file adds global window functions to debug WebSocket connections
 * from the browser console.
 */

import { diagnoseAwsConnectivity } from './aws-connectivity-check';
import { printWebSocket1006Report } from './websocket-1006-helper';
import { initializeWebSocket, getWebSocketStatus, ConnectionStatus } from './aws-websocket-service';

// Add global functions for WebSocket debugging
if (typeof window !== 'undefined') {
  // Main diagnostic function
  (window as any).testWebSocketConnection = async () => {
    console.log('Testing WebSocket connection...');
    
    try {
      await diagnoseAwsConnectivity();
      console.log('✅ WebSocket diagnostic complete. Check results above.');
    } catch (error) {
      console.error('❌ WebSocket diagnostic failed:', error);
    }
  };
  
  // Special diagnostic for code 1006 errors
  (window as any).diagnose1006Error = (url?: string) => {
    const websocketUrl = url || 
                         process.env.NEXT_PUBLIC_WEBSOCKET_URL || 
                         process.env.NEXT_PUBLIC_WEBSOCKET_API_URL;
    
    if (!websocketUrl) {
      console.error('❌ No WebSocket URL provided or configured in environment variables');
      return;
    }
    
    console.log(`🔍 Running specific diagnostics for WebSocket 1006 error on ${websocketUrl}`);
    printWebSocket1006Report(websocketUrl);
  };
  
  // Mock mode control
  (window as any).enableMockMode = () => {
    localStorage.setItem('force_mock_mode', 'true');
    console.log('✅ Mock mode enabled. Reload the page to apply the change.');
    console.log('You can disable mock mode by running window.disableMockMode()');
  };
  
  (window as any).disableMockMode = () => {
    localStorage.removeItem('force_mock_mode');
    localStorage.removeItem('websocket_failed_attempts');
    console.log('✅ Mock mode disabled. Reload the page to apply the change.');
  };
  
  // Connection management
  (window as any).reconnectWebSocket = async () => {
    try {
      console.log('Attempting to reconnect WebSocket...');
      localStorage.removeItem('websocket_failed_attempts');
      await initializeWebSocket();
      
      const status = getWebSocketStatus();
      if (status === ConnectionStatus.CONNECTED) {
        console.log('✅ WebSocket successfully reconnected!');
      } else {
        console.log(`❌ WebSocket reconnection failed. Status: ${status}`);
      }
    } catch (error) {
      console.error('❌ Error reconnecting WebSocket:', error);
    }
  };
  
  // Environment information
  (window as any).getWebSocketStatus = () => {
    const status = getWebSocketStatus();
    console.log(`Current WebSocket status: ${status}`);
    return status;
  };
  
  (window as any).getWebSocketUrl = () => {
    const url = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_WEBSOCKET_API_URL;
    console.log(`Configured WebSocket URL: ${url || 'Not configured'}`);
    return url;
  };
  
  (window as any).checkMockStatus = () => {
    const forceMockMode = localStorage.getItem('force_mock_mode') === 'true';
    const envMockMode = process.env.NEXT_PUBLIC_MOCK_SERVICES === 'true';
    
    console.log('Mock mode status:');
    console.log(`- Forced by localStorage: ${forceMockMode ? 'Yes' : 'No'}`);
    console.log(`- Enabled by environment: ${envMockMode ? 'Yes' : 'No'}`);
    console.log(`- Effective status: ${forceMockMode || envMockMode ? 'ENABLED' : 'DISABLED'}`);
    
    return {
      forceMockMode,
      envMockMode,
      effective: forceMockMode || envMockMode
    };
  };
  
  (window as any).resetConnectionAttempts = () => {
    localStorage.removeItem('websocket_failed_attempts');
    console.log('✅ WebSocket connection attempt counter reset');
  };
  
  console.log('🛠️ WebSocket Debugging Tools loaded in console. Available commands:');
  console.log('- window.testWebSocketConnection() - Run comprehensive diagnostics');
  console.log('- window.diagnose1006Error() - Run specialized 1006 error diagnostics');
  console.log('- window.enableMockMode() - Switch to mock mode');
  console.log('- window.disableMockMode() - Switch to real API mode');
  console.log('- window.reconnectWebSocket() - Attempt to reconnect WebSocket');
  console.log('- window.getWebSocketStatus() - Check current connection status');
  console.log('- window.getWebSocketUrl() - Show configured WebSocket URL');
  console.log('- window.checkMockStatus() - Check if mock mode is enabled');
  console.log('- window.resetConnectionAttempts() - Reset failed connection counter');
}
