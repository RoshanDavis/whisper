import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  importPrivateKey, 
  importPublicKey, 
  deriveSharedSecret, 
  encryptMessage, 
  decryptMessage,
  importEcdsaPrivateKey,
  importEcdsaPublicKey,
  signData,
  verifySignature
} from '../utils/crypto';

interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  isOwnMessage: boolean;
  isVerified?: boolean;
}

interface ChatAreaProps {
  selectedContact: any | null;
}

export default function ChatArea({ selectedContact }: ChatAreaProps) {
  const { currentUser, userId } = useAuth();
  const { socket, isConnected } = useSocket();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedContact || !userId || !currentUser) return;

    const loadHistory = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/auth/messages/${userId}/${selectedContact.id}`);
        const encryptedHistory = await res.json();

        const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
        if (!privKeyBase64) throw new Error("Private key missing");
        const privateKey = await importPrivateKey(privKeyBase64);
        
        const publicKey = await importPublicKey(selectedContact.publicKey);
        const publicSigningKey = await importEcdsaPublicKey(selectedContact.publicSigningKey);
        
        const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
        const decryptedMessages: Message[] = [];
        
        for (const msg of encryptedHistory) {
          try {
            const isOwn = msg.senderId === userId;
            let isValid = true;

            if (!isOwn) {
              isValid = await verifySignature(publicSigningKey, msg.signature, msg.ciphertext);
              if (!isValid) throw new Error("Signature invalid");
            }

            const text = await decryptMessage(sharedSecret, msg.ciphertext, msg.iv);
            decryptedMessages.push({
              id: msg.id,
              text,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              isOwnMessage: isOwn,
              isVerified: isValid,
            });
          } catch (err) {
            decryptedMessages.push({
              id: msg.id,
              text: "⚠️ [Security Warning - Validation Failed]",
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              isOwnMessage: msg.senderId === userId,
              isVerified: false,
            });
          }
        }
        setMessages(decryptedMessages);
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    };

    loadHistory();
  }, [selectedContact, userId, currentUser]);

  useEffect(() => {
    if (!socket || !selectedContact || !userId || !currentUser) return;

    const handleReceive = async (savedMessage: any) => {
      if (savedMessage.receiverId !== userId || savedMessage.senderId !== selectedContact.id) return;

      try {
        const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
        if (!privKeyBase64) throw new Error("Private key missing");
        
        const privateKey = await importPrivateKey(privKeyBase64);
        const publicKey = await importPublicKey(selectedContact.publicKey);
        const publicSigningKey = await importEcdsaPublicKey(selectedContact.publicSigningKey);

        const isValidSignature = await verifySignature(publicSigningKey, savedMessage.signature, savedMessage.ciphertext);
        if (!isValidSignature) throw new Error("SECURITY ALERT: Invalid signature!");

        const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
        const decryptedText = await decryptMessage(sharedSecret, savedMessage.ciphertext, savedMessage.iv);

        setMessages((prev) => [...prev, {
          id: savedMessage.id,
          text: decryptedText,
          senderId: savedMessage.senderId,
          receiverId: savedMessage.receiverId,
          isOwnMessage: false,
          isVerified: true,
        }]);
      } catch (err) {
        console.error("Decryption failed:", err);
      }
    };

    socket.on('receiveMessage', handleReceive);
    return () => { socket.off('receiveMessage', handleReceive); };
  }, [socket, selectedContact, userId, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !userId || !currentUser || !selectedContact || !socket) return;

    const textToEncrypt = inputText;
    setInputText(''); 

    const tempId = Date.now().toString();
    setMessages((prev) => [...prev, {
      id: tempId,
      text: textToEncrypt,
      senderId: userId,
      receiverId: selectedContact.id,
      isOwnMessage: true,
      isVerified: true,
    }]);

    try {
      const privKeyBase64 = localStorage.getItem(`whisper_priv_${currentUser}`);
      const signPrivKeyBase64 = localStorage.getItem(`whisper_sign_priv_${currentUser}`);
      if (!privKeyBase64 || !signPrivKeyBase64) throw new Error("Keys missing");
      
      const privateKey = await importPrivateKey(privKeyBase64);
      const signPrivateKey = await importEcdsaPrivateKey(signPrivKeyBase64);
      const publicKey = await importPublicKey(selectedContact.publicKey);

      const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
      const { ciphertext, iv } = await encryptMessage(sharedSecret, textToEncrypt);
      const signature = await signData(signPrivateKey, ciphertext);

      socket.emit('sendMessage', {
        receiverId: selectedContact.id, 
        ciphertext,
        iv,
        signature
      });
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 h-full bg-vault-base m-4 ml-0 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-gray-700/50 shadow-lg">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-brand to-emerald-500"></div>
        <div className="w-16 h-16 rounded-full bg-vault-panel flex items-center justify-center mb-4 border border-gray-700">
          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-300">Your Secure Vault</h3>
        <p className="text-gray-500 text-sm mt-2 max-w-xs text-center">Select a contact to initiate an End-to-End Encrypted session.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-vault-base m-4 ml-0 flex flex-col relative overflow-hidden rounded-2xl border border-gray-700/50 shadow-lg">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-brand to-emerald-500 z-10"></div>
      
      <header className="px-6 py-4 bg-vault-panel/80 backdrop-blur-md border-b border-gray-700/50 flex items-center justify-between shrink-0 z-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold shadow-inner">
            {selectedContact.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-gray-100">{selectedContact.username}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_5px_var(--color-brand)]"></span>
              <span className="text-xs text-brand font-medium tracking-wide">E2EE Verified</span>
            </div>
          </div>
        </div>
        
        <div className={`text-xs px-2 py-1 rounded border ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {isConnected ? 'Socket Connected' : 'Socket Reconnecting...'}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-700 z-0">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col text-gray-500">
             <span className="mb-2">🔒</span>
             <p className="text-sm">Messages are end-to-end encrypted.</p>
             <p className="text-xs mt-1">Nobody outside of this chat can read them.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-5 py-3 rounded-2xl shadow-sm ${
                !msg.isVerified ? 'bg-red-900/50 text-red-200 border border-red-700 rounded-bl-none' :
                msg.isOwnMessage ? 'bg-brand text-white rounded-br-none' : 'bg-vault-panel border border-gray-700/50 text-gray-100 rounded-bl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="p-4 bg-vault-panel/80 backdrop-blur-md border-t border-gray-700/50 shrink-0 z-0">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto">
          <input 
            type="text" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            placeholder="Type an encrypted message..." 
            className="flex-1 bg-vault-base border border-gray-700 rounded-full px-6 py-3.5 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all placeholder-gray-500 text-gray-100 text-sm shadow-inner" 
          />
          <button 
            type="submit" 
            disabled={!inputText.trim()} 
            className="bg-brand hover:bg-brand-hover disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none text-white font-bold px-8 py-3.5 rounded-full transition-all shadow-[0_0_15px_var(--color-brand-glow)] flex items-center justify-center"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}