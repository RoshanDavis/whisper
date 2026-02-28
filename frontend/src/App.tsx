import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import { importPrivateKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from './utils/crypto';

const socket = io('http://localhost:3000');

interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  isOwnMessage: boolean;
}

interface User {
  id: string;
  username: string;
}

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('whisper_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('whisper_username'));
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('whisper_userid'));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      fetch('http://localhost:3000/api/auth/users')
        .then(res => res.json())
        .then(data => setUsersList(data.filter((u: User) => u.id !== userId)))
        .catch(err => console.error("Failed to fetch users", err));
    }
  }, [token, userId]);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      if (userId) socket.emit('registerUser', userId);
    });
    
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('receiveMessage', async (savedMessage) => {
      if (savedMessage.receiverId !== userId) return;

      try {
        const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
        if (!privKeyBase64) throw new Error("Private key not found!");

        const privateKey = await importPrivateKey(privKeyBase64);
        const res = await fetch(`http://localhost:3000/api/auth/users/${savedMessage.senderId}/key`);
        const { publicKey: pubKeyBase64 } = await res.json();
        const publicKey = await importPublicKey(pubKeyBase64);

        const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
        const decryptedText = await decryptMessage(sharedSecret, savedMessage.ciphertext, savedMessage.iv);

        setMessages((prev) => [...prev, {
          id: savedMessage.id,
          text: decryptedText,
          senderId: savedMessage.senderId,
          receiverId: savedMessage.receiverId,
          isOwnMessage: false,
        }]);
        
      } catch (err) {
        console.error("Decryption failed:", err);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receiveMessage');
    };
  }, [userId, currentUser]); 

  // --- NEW FEATURE: LOAD AND DECRYPT MESSAGE HISTORY ---
  useEffect(() => {
    if (!selectedUser || !userId || !currentUser) return;

    const loadMessageHistory = async () => {
      try {
        // 1. Fetch the encrypted rows from Supabase
        const res = await fetch(`http://localhost:3000/api/auth/messages/${userId}/${selectedUser.id}`);
        const encryptedHistory = await res.json();

        // 2. Prep our cryptographic keys
        const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
        if (!privKeyBase64) throw new Error("Private key not found!");
        
        const privateKey = await importPrivateKey(privKeyBase64);
        const keyRes = await fetch(`http://localhost:3000/api/auth/users/${selectedUser.id}/key`);
        const { publicKey: pubKeyBase64 } = await keyRes.json();
        const publicKey = await importPublicKey(pubKeyBase64);

        const sharedSecret = await deriveSharedSecret(privateKey, publicKey);

        // 3. Decrypt the entire array of messages in bulk
        const decryptedMessages: Message[] = [];
        for (const msg of encryptedHistory) {
          try {
            const text = await decryptMessage(sharedSecret, msg.ciphertext, msg.iv);
            decryptedMessages.push({
              id: msg.id,
              text: text,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              isOwnMessage: msg.senderId === userId,
            });
          } catch (err) {
            decryptedMessages.push({
              id: msg.id,
              text: "🔒 [Encrypted Message - Decryption Failed]",
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              isOwnMessage: msg.senderId === userId,
            });
          }
        }

        // 4. Update the screen
        setMessages(decryptedMessages);

      } catch (err) {
        console.error("Failed to load message history:", err);
      }
    };

    loadMessageHistory();
  }, [selectedUser, userId, currentUser]);
  // ---------------------------------------------------

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
    localStorage.removeItem('whisper_token');
    localStorage.removeItem('whisper_username');
    localStorage.removeItem('whisper_userid');
    setToken(null);
    setCurrentUser(null);
    setUserId(null);
    setMessages([]); 
    setSelectedUser(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !userId || !currentUser || !selectedUser) return;

    const tempId = Date.now().toString();
    const myNewMessage: Message = {
      id: tempId,
      text: inputText,
      senderId: userId,
      receiverId: selectedUser.id,
      isOwnMessage: true,
    };
    
    // We update the screen instantly for a snappy UI, but we must also ensure 
    // it doesn't get duplicated if we were to re-fetch history.
    setMessages((prev) => [...prev, myNewMessage]);
    
    const textToEncrypt = inputText;
    setInputText(''); 

    try {
      const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
      if (!privKeyBase64) throw new Error("Private key not found!");
      const privateKey = await importPrivateKey(privKeyBase64);

      const res = await fetch(`http://localhost:3000/api/auth/users/${selectedUser.id}/key`);
      const { publicKey: pubKeyBase64 } = await res.json();
      const publicKey = await importPublicKey(pubKeyBase64);

      const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
      const { ciphertext, iv } = await encryptMessage(sharedSecret, textToEncrypt);

      socket.emit('sendMessage', {
        receiverId: selectedUser.id, 
        ciphertext,
        iv
      });

    } catch (err) {
      console.error("Encryption error:", err);
      alert("Failed to encrypt message. Check console.");
    }
  };

  if (!token) return <Auth onAuthSuccess={handleAuthSuccess} />;

  const currentConversation = messages.filter(
    (msg) => 
      (msg.senderId === userId && msg.receiverId === selectedUser?.id) || 
      (msg.senderId === selectedUser?.id && msg.receiverId === userId)
  );

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-1/4 min-w-[250px] bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-emerald-400 tracking-wide mb-2">Whisper</h1>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 truncate">@{currentUser}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'}></div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 pt-2 pb-1">Contacts</h2>
          {usersList.length === 0 ? (
            <div className="text-sm text-gray-500 px-2 italic">No other users found.</div>
          ) : (
            usersList.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                  selectedUser?.id === user.id ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium truncate">{user.username}</span>
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-gray-700">
          <button onClick={handleLogout} className="w-full text-sm bg-gray-700 hover:bg-gray-600 py-2 rounded text-gray-300 transition-colors">
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col bg-gray-900">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a contact to start a secure chat.
          </div>
        ) : (
          <>
            <header className="p-4 bg-gray-800 border-b border-gray-700 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-gray-100">{selectedUser.username}</h2>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> E2E Encrypted
                </span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentConversation.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500 italic">
                  No messages yet. Say hello to {selectedUser.username}!
                </div>
              ) : (
                currentConversation.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${msg.isOwnMessage ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-100 rounded-bl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-4 bg-gray-800 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={`Message ${selectedUser.username}...`} className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder-gray-500 text-gray-100" />
                <button type="submit" disabled={!inputText.trim()} className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-bold px-6 py-3 rounded-full transition-colors flex items-center justify-center">Send</button>
              </form>
            </footer>
          </>
        )}
      </main>

    </div>
  );
}