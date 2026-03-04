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
  const { isAuthenticated, userId } = useAuth();

  useEffect(() => {
    let newSocket: Socket | null = null;

    // Only establish a connection if the user is fully authenticated
    if (isAuthenticated && userId) {
      const socketUrl = import.meta.env.VITE_API_URL || undefined;
      newSocket = io(socketUrl, {
        withCredentials: true, // Send HttpOnly cookie with handshake
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        // Tell the backend who this socket belongs to (server verifies via JWT cookie)
        newSocket!.emit('registerUser', userId);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      setSocket(newSocket);
    }

    // Cleanup: sever connection and reset state when auth changes or unmount
    return () => {
      newSocket?.off('connect');
      newSocket?.off('disconnect');
      newSocket?.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, userId]); 

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