// frontend/src/contexts/SocketContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // We grab the auth state so we only connect when a user is actually logged in
  const { token, userId } = useAuth();

  useEffect(() => {
    let newSocket: Socket;

    // Only establish a connection if the user is fully authenticated
    if (token && userId) {
      newSocket = io('http://localhost:3000');

      newSocket.on('connect', () => {
        setIsConnected(true);
        // The moment we connect, tell the backend who this socket belongs to
        newSocket.emit('registerUser', userId);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      setSocket(newSocket);
    }

    // Cleanup function: If the user logs out or closes the app, sever the connection
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [token, userId]); 

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

// Custom hook for our UI components to easily grab the live socket
export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}