import { useState, useEffect, useRef, useCallback } from "react";

export interface UseWebSocketProps {
  url?: string;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
}

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  error: Error | null;
  connecting: boolean;
}

export function useWebSocket({
  url,
  onOpen,
  onMessage,
  onClose,
  onError,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
  autoConnect = true,
}: UseWebSocketProps) {
  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    error: null,
    connecting: false,
  });

  const reconnectCount = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any reconnection timeout to avoid memory leaks
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Function to create a new WebSocket connection
  const connect = useCallback(
    async (customUrl?: string): Promise<WebSocket> => {
      if (!customUrl && !url) {
        throw new Error('WebSocket URL not provided');
      }

      // Determine WebSocket URL
      let wsUrl = customUrl || url;
      if (!wsUrl) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }

      setState(prev => ({ ...prev, connecting: true, error: null }));

      return new Promise((resolve, reject) => {
        try {
          const socket = new WebSocket(wsUrl as string);

          socket.onopen = (event) => {
            console.log('WebSocket connected');
            setState(prev => ({ 
              ...prev, 
              socket, 
              isConnected: true, 
              connecting: false, 
              error: null 
            }));
            
            // Reset reconnect counter on successful connection
            reconnectCount.current = 0;
            
            // Call custom onOpen handler if provided
            if (onOpen) {
              onOpen(event);
            }
            
            resolve(socket);
          };

          socket.onmessage = (event) => {
            // Call custom onMessage handler if provided
            if (onMessage) {
              onMessage(event);
            }
          };

          socket.onclose = (event) => {
            console.log('WebSocket disconnected', event);
            setState(prev => ({ 
              ...prev, 
              socket: null, 
              isConnected: false, 
              connecting: false 
            }));
            
            // Call custom onClose handler if provided
            if (onClose) {
              onClose(event);
            }
            
            // Attempt to reconnect if not closed cleanly and within retry limit
            if (!event.wasClean && reconnectCount.current < reconnectAttempts) {
              reconnectCount.current += 1;
              console.log(`Attempting to reconnect (${reconnectCount.current}/${reconnectAttempts})...`);
              
              clearReconnectTimeout();
              reconnectTimeoutRef.current = setTimeout(() => {
                connect(wsUrl);
              }, reconnectInterval);
            }
          };

          socket.onerror = (event) => {
            console.error('WebSocket error:', event);
            setState(prev => ({ 
              ...prev, 
              error: new Error('WebSocket error occurred'), 
              connecting: false 
            }));
            
            // Call custom onError handler if provided
            if (onError) {
              onError(event);
            }
            
            reject(new Error('WebSocket connection error'));
          };
        } catch (error) {
          console.error('Error creating WebSocket:', error);
          setState(prev => ({ 
            ...prev, 
            error: error as Error, 
            connecting: false 
          }));
          reject(error);
        }
      });
    },
    [url, onOpen, onMessage, onClose, onError, reconnectAttempts, reconnectInterval, clearReconnectTimeout]
  );

  // Disconnect the WebSocket
  const disconnect = useCallback(() => {
    if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) {
      state.socket.close();
      clearReconnectTimeout();
    }
  }, [state.socket, clearReconnectTimeout]);

  // Send a message through the WebSocket
  const send = useCallback(
    (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (state.socket?.readyState === WebSocket.OPEN) {
        state.socket.send(data);
        return true;
      }
      return false;
    },
    [state.socket]
  );

  // Auto-connect when the component mounts if autoConnect is true
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Clean up on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: state.socket,
    isConnected: state.isConnected,
    error: state.error,
    connecting: state.connecting,
    connect,
    disconnect,
    send,
  };
}
