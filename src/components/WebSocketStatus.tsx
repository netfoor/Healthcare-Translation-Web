'use client';

import React from 'react';
import { ConnectionStatus } from '../lib/websocket-manager';

export interface WebSocketStatusProps {
  status: ConnectionStatus;
  reconnectAttempts?: number;
  className?: string;
  showDetails?: boolean;
}

export function WebSocketStatus({ 
  status, 
  reconnectAttempts = 0, 
  className = '',
  showDetails = false 
}: WebSocketStatusProps) {
  const getStatusConfig = (status: ConnectionStatus) => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: '●',
          text: 'Connected',
          description: 'Real-time connection active'
        };
      case ConnectionStatus.CONNECTING:
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: '◐',
          text: 'Connecting',
          description: 'Establishing connection...'
        };
      case ConnectionStatus.RECONNECTING:
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          icon: '◑',
          text: reconnectAttempts === 0 ? 'Connecting' : 'Reconnecting',
          description: reconnectAttempts === 0 ? 'Establishing connection...' : `Reconnecting... (attempt ${reconnectAttempts})`
        };
      case ConnectionStatus.ERROR:
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: '●',
          text: 'Connection Error',
          description: 'Unable to connect to server'
        };
      case ConnectionStatus.DISCONNECTED:
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: '○',
          text: 'Disconnected',
          description: 'Not connected to server'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${config.bgColor} ${className}`}>
      <span className={`${config.color} font-mono text-lg leading-none`} aria-hidden="true">
        {config.icon}
      </span>
      <span className={`${config.color} font-medium`}>
        {config.text}
      </span>
      {showDetails && (
        <span className={`${config.color} text-xs opacity-75`}>
          {config.description}
        </span>
      )}
    </div>
  );
}

export interface WebSocketStatsProps {
  stats: {
    status: ConnectionStatus;
    reconnectAttempts: number;
    queuedMessages: number;
    pendingMessages: number;
    activeListeners: number;
  };
  className?: string;
}

export function WebSocketStats({ stats, className = '' }: WebSocketStatsProps) {
  return (
    <div className={`bg-gray-50 rounded-lg p-4 space-y-2 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Connection Statistics</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Status:</span>
          <WebSocketStatus status={stats.status} reconnectAttempts={stats.reconnectAttempts} />
        </div>
        
        <div>
          <span className="text-gray-500">Reconnect Attempts:</span>
          <span className="ml-2 font-mono">{stats.reconnectAttempts}</span>
        </div>
        
        <div>
          <span className="text-gray-500">Queued Messages:</span>
          <span className="ml-2 font-mono">{stats.queuedMessages}</span>
        </div>
        
        <div>
          <span className="text-gray-500">Pending Messages:</span>
          <span className="ml-2 font-mono">{stats.pendingMessages}</span>
        </div>
        
        <div className="col-span-2">
          <span className="text-gray-500">Active Listeners:</span>
          <span className="ml-2 font-mono">{stats.activeListeners}</span>
        </div>
      </div>
    </div>
  );
}