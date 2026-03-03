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

const getContactColor = (username: string) => {
  const colors = [
    'bg-contact-1',
    'bg-contact-2',
    'bg-contact-3',
    'bg-contact-4',
    'bg-contact-5',
    'bg-contact-6',
    'bg-contact-7',
    'bg-contact-8',
    'bg-contact-9',
    'bg-contact-10',
    'bg-contact-11',
    'bg-contact-12'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function ChatArea({ selectedContact }: ChatAreaProps) {
  const { currentUser, userId } = useAuth();
  const { socket, isConnected } = useSocket();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // FULLY RESTORED LOGIC
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

  const handleSendMessage = async (e: React.SyntheticEvent<HTMLFormElement>) => {
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

  // UI: Empty State
  if (!selectedContact) {
    return (
      <div className="flex-1 h-full bg-primary-950 ml-0 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-primary-50 shadow-lg mr-5">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-primary-400 to-secondary-500"></div>
        <div className="w-16 h-16 rounded-full bg-primary-900 flex items-center justify-center mb-4 border border-primary-800">
          <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-primary-50">Your Secure Vault</h3>
        <p className="text-primary-400 text-sm mt-2 max-w-xs text-center">Select a contact to initiate an End-to-End Encrypted session.</p>
      </div>
    );
  }

  // Get the specific shade for the currently selected contact
 const contactColor = getContactColor(selectedContact.username);

  // UI: Active Chat Session
  return (
    <div className="flex-1 h-full bg-primary-950 ml-0 flex flex-col relative overflow-hidden rounded-2xl border border-primary-50 shadow-lg mr-5"> 
      <header className="px-6 py-4 bg-primary-950 backdrop-blur-md flex items-center justify-between shrink-0 z-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${contactColor} flex items-center justify-center text-primary-50 font-bold shadow-inner`}>
            {selectedContact.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-primary-50">{selectedContact.username}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shadow-[0_0_5px_var(--color-primary-400)]"></span>
              <span className="text-xs text-primary-400 font-medium tracking-wide">E2EE Verified</span>
            </div>
          </div>
        </div>
        
        <div className={`text-xs px-2 py-1 rounded border ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {isConnected ? 'Socket Connected' : 'Socket Reconnecting...'}
        </div>
      </header>

      <div className="mx-6 h-px bg-linear-to-r from-transparent via-primary-400/80 to-transparent shrink-0"></div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 z-0">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col text-primary-400">
             <span className="mb-2">🔒</span>
             <p className="text-sm">Messages are end-to-end encrypted.</p>
             <p className="text-xs mt-1 text-primary-500">Nobody outside of this chat can read them.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-5 py-3 rounded-2xl shadow-sm ${
                !msg.isVerified ? 'bg-secondary-900/50 text-secondary-200 border border-secondary-700 rounded-bl-none' :
                msg.isOwnMessage ? 'bg-primary-600 text-primary-50 rounded-br-none' : `${contactColor} text-primary-50 rounded-bl-none`
              }`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mx-6 h-px bg-linear-to-r from-transparent via-primary-400/80 to-transparent shrink-0"></div>

      <footer className="p-4 bg-primary-950 backdrop-blur-md shrink-0 z-0">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto">
          <input 
            type="text" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            placeholder="Type a message here..." 
            className="flex-1 bg-primary-950 border border-primary-50 rounded-full px-6 py-3.5 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-primary-50 text-primary-50 text-sm shadow-inner" 
          />
          <button 
            type="submit" 
            disabled={!inputText.trim()} 
            className="bg-primary-600 hover:bg-primary-500 disabled:shadow-none text-primary-50 font-bold px-8 py-3.5 rounded-full transition-all shadow-[0_0_15px_rgba(0,186,239,0.3)] flex items-center justify-center"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}