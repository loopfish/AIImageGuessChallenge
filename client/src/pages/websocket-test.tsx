import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WebSocketTest() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [messages, setMessages] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  const handleConnect = () => {
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    try {
      // Create a new WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log("Connecting to WebSocket at:", wsUrl);
      setConnectionStatus("Connecting...");
      addMessage(`Connecting to ${wsUrl}...`);
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // WebSocket event handlers
      socket.onopen = () => {
        console.log("WebSocket connected!");
        setIsConnected(true);
        setConnectionStatus("Connected");
        addMessage("WebSocket connected successfully!");
      };
      
      socket.onclose = (event) => {
        console.log("WebSocket closed:", event);
        setIsConnected(false);
        setConnectionStatus("Disconnected");
        addMessage(`Connection closed. ${event.wasClean ? 'Clean disconnect' : 'Connection lost'}.`);
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("Error");
        addMessage("Connection error occurred.");
      };
      
      socket.onmessage = (event) => {
        console.log("Message received:", event.data);
        try {
          const data = JSON.parse(event.data);
          addMessage(`Received: ${JSON.stringify(data, null, 2)}`);
        } catch (err) {
          addMessage(`Received: ${event.data}`);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionStatus("Failed");
      addMessage(`Error creating WebSocket: ${error}`);
    }
  };

  const handleDisconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setConnectionStatus("Disconnected manually");
      addMessage("Disconnected manually");
    }
  };

  const handleSendMessage = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const testMessage = {
        type: "ping",
        payload: { timestamp: Date.now(), client: "web-client" }
      };
      
      socketRef.current.send(JSON.stringify(testMessage));
      addMessage(`Sent: ${JSON.stringify(testMessage, null, 2)}`);
    } else {
      addMessage("Cannot send message: not connected");
    }
  };

  const addMessage = (message: string) => {
    setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">WebSocket Test Tool</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>WebSocket Status: <span 
            className={
              isConnected ? "text-green-600" : 
              connectionStatus === "Connecting..." ? "text-yellow-600" :
              "text-red-600"
            }
          >
            {connectionStatus}
          </span></CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button 
            onClick={handleConnect} 
            disabled={connectionStatus === "Connecting..."}
            variant={isConnected ? "outline" : "default"}
          >
            Connect
          </Button>
          
          <Button 
            onClick={handleDisconnect} 
            disabled={!isConnected}
            variant="outline"
          >
            Disconnect
          </Button>
          
          <Button 
            onClick={handleSendMessage} 
            disabled={!isConnected}
          >
            Send Test Message
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>WebSocket Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-md h-[400px] overflow-y-auto font-mono text-sm">
            {messages.length === 0 ? (
              <div className="text-gray-500 italic">No messages yet. Connect to get started.</div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className="whitespace-pre-wrap">{msg}</div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}