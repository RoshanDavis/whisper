import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import { importPrivateKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from './utils/crypto';

const socket = io('http://localhost:3000');

interface Message {
  id: string;
  text: string;
  isOwnMessage: boolean;
}

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('whisper_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('whisper_username'));
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('whisper_userid'));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      if (userId) socket.emit('registerUser', userId);
    });
    
    socket.on('disconnect', () => setIsConnected(false));

    // Listen for ENCRYPTED messages bouncing back from the database
    socket.on('receiveMessage', async (savedMessage) => {
      try {
        const currentUsername = localStorage.getItem('whisper_username');
        const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUsername}`);
        
        if (!privKeyBase64) throw new Error("Private key not found in local storage!");

        // 1. Load our Private Key
        const privateKey = await importPrivateKey(privKeyBase64);

        // 2. Fetch the Sender's Public Key
        const res = await fetch(`http://localhost:3000/api/auth/users/${savedMessage.senderId}/key`);
        const { publicKey: pubKeyBase64 } = await res.json();
        const publicKey = await importPublicKey(pubKeyBase64);

        // 3. Derive the Shared Secret and Decrypt!
        const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
        const decryptedText = await decryptMessage(sharedSecret, savedMessage.ciphertext, savedMessage.iv);

        const newMessage: Message = {
          id: savedMessage.id,
          text: decryptedText,
          isOwnMessage: savedMessage.senderId === userId,
        };
        setMessages((prev) => [...prev, newMessage]);
        
      } catch (err) {
        console.error("Decryption failed:", err);
        // If decryption fails, show a locked indicator instead of crashing
        setMessages((prev) => [...prev, {
          id: savedMessage.id,
          text: "🔒 [Encrypted Message - Decryption Failed]",
          isOwnMessage: savedMessage.senderId === userId,
        }]);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receiveMessage');
    };
  }, [userId]); 

  useEffect(() => {
    if (isConnected && userId) socket.emit('registerUser', userId);
  }, [isConnected, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuthSuccess = (newToken: string, username: string, newUserId: string) => {
    localStorage.setItem('whisper_token', newToken);
    localStorage.setItem('whisper_username', username);
    localStorage.setItem('whisper_userid', newUserId); 
    setToken(newToken);
    setCurrentUser(username);
    setUserId(newUserId);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setCurrentUser(null);
    setUserId(null);
    setMessages([]); // Clear chat history on logout
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !userId || !currentUser) return;

    try {
      // 1. Get our Private Key
      const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
      if (!privKeyBase64) throw new Error("Private key not found!");
      const privateKey = await importPrivateKey(privKeyBase64);

      // 2. Fetch the Receiver's Public Key (Currently sending to ourselves!)
      const res = await fetch(`http://localhost:3000/api/auth/users/${userId}/key`);
      const { publicKey: pubKeyBase64 } = await res.json();
      const publicKey = await importPublicKey(pubKeyBase64);

      // 3. Derive the Shared Secret and Encrypt!
      const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
      const { ciphertext, iv } = await encryptMessage(sharedSecret, inputText);

      // 4. Send the completely scrambled data to the backend
      socket.emit('sendMessage', {
        receiverId: userId, 
        ciphertext,
        iv
      });

      setInputText('');
    } catch (err) {
      console.error("Encryption error:", err);
      alert("Failed to encrypt message. Check console.");
    }
  };

  if (!token) return <Auth onAuthSuccess={handleAuthSuccess} />;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-md">
        <h1 className="text-2xl font-bold text-emerald-400 tracking-wide">Whisper</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Logged in as <strong className="text-gray-200">{currentUser}</strong></span>
          <button onClick={handleLogout} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-gray-300 transition-colors">Logout</button>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500 italic">
            No messages yet. Start a secure conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${msg.isOwnMessage ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-100 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-gray-800 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a secure message..." className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder-gray-500 text-gray-100" />
          <button type="submit" disabled={!inputText.trim()} className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-bold px-6 py-3 rounded-full transition-colors flex items-center justify-center">Send</button>
        </form>
      </footer>
    </div>
  );
}