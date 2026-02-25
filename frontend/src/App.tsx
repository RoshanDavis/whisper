import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Connect to your backend URL
const socket = io('http://localhost:3000');

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // Listen for connection success
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server with ID:', socket.id);
    });

    // Listen for disconnection
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    // Cleanup function to avoid duplicate connections if React re-renders
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-900 gap-4">
      <h1 className="text-4xl font-bold text-emerald-400">
        Whisper E2EE Chat
      </h1>
      
      {/* Display the connection status dynamically */}
      <div className={`px-4 py-2 rounded-full font-semibold ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
        {isConnected ? '🟢 Server Connected' : '🔴 Disconnected'}
      </div>
    </div>
  );
}