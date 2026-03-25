import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { getContactColor } from "../utils/contactColor";
import API_URL, { authFetch } from "../utils/api";
import type { Contact } from "./ContactsSidebar";
import {
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
  importEcdsaPublicKey,
  signData,
  verifySignature,
} from "../utils/crypto";

interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  isOwnMessage: boolean;
  isVerified?: boolean;
  pending?: boolean; // optimistic entry not yet confirmed by server
  failed?: boolean; // server reported a save error
}

interface ChatAreaProps {
  selectedContact: Contact | null;
  onBack?: () => void;
}

export default function ChatArea({ selectedContact, onBack }: ChatAreaProps) {
  const { currentUser, userId, ecdhPrivateKey, ecdsaPrivateKey } = useAuth();
  const { socket, isConnected } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cache derived crypto keys per contact to avoid redundant WebCrypto operations
  const cryptoCacheRef = useRef<{
    contactId: string;
    publicKey: CryptoKey;
    publicSigningKey: CryptoKey;
    sharedSecret: CryptoKey;
  } | null>(null);

  const getCryptoKeys = async (contact: Contact) => {
    const cached = cryptoCacheRef.current;
    if (cached && cached.contactId === contact.id) return cached;
    const pubKey = await importPublicKey(contact.publicKey);
    const sigKey = await importEcdsaPublicKey(contact.publicSigningKey);
    const shared = await deriveSharedSecret(ecdhPrivateKey!, pubKey);
    const entry = {
      contactId: contact.id,
      publicKey: pubKey,
      publicSigningKey: sigKey,
      sharedSecret: shared,
    };
    cryptoCacheRef.current = entry;
    return entry;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // FULLY RESTORED LOGIC
  useEffect(() => {
    if (!selectedContact || !userId || !currentUser || !ecdhPrivateKey) return;

    // Clear stale messages and crypto cache from previous contact
    setMessages([]);
    cryptoCacheRef.current = null;

    // Snapshot the current contact to detect stale responses
    const contactId = selectedContact.id;
    const controller = new AbortController();

    const loadHistory = async () => {
      try {
        const res = await authFetch(
          `${API_URL}/api/auth/messages/${userId}/${contactId}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!res.ok) {
          console.error(`Failed to load history: ${res.status}`);
          return;
        }
        const encryptedHistory = await res.json();

        const keys = await getCryptoKeys(selectedContact);
        if (controller.signal.aborted) return;

        const decryptedMessages: Message[] = [];

        for (const msg of encryptedHistory) {
          if (controller.signal.aborted) return;
          try {
            const isOwn = msg.senderId === userId;
            let isValid = true;

            if (!isOwn) {
              isValid = await verifySignature(
                keys.publicSigningKey,
                msg.signature,
                msg.ciphertext,
              );
              if (!isValid) throw new Error("Signature invalid");
            }

            const text = await decryptMessage(
              keys.sharedSecret,
              msg.ciphertext,
              msg.iv,
            );
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

        // Only update state if this effect is still current
        if (!controller.signal.aborted && selectedContact?.id === contactId) {
          setMessages(decryptedMessages);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Failed to load history:", err);
        }
      }
    };

    loadHistory();

    return () => {
      controller.abort();
    };
  }, [selectedContact?.id, userId]);

  useEffect(() => {
    if (
      !socket ||
      !selectedContact ||
      !userId ||
      !currentUser ||
      !ecdhPrivateKey
    )
      return;

    let isActive = true;

    const handleReceive = async (savedMessage: any) => {
      if (!isActive) return;

      // Accept messages belonging to this two-party conversation (either direction)
      const isInbound =
        savedMessage.senderId === selectedContact.id &&
        savedMessage.receiverId === userId;
      const isOwnEcho =
        savedMessage.senderId === userId &&
        savedMessage.receiverId === selectedContact.id;
      if (!isInbound && !isOwnEcho) return;

      try {
        const keys = await getCryptoKeys(selectedContact);
        if (!isActive) return;

        // Only verify signature on messages from the contact (not our own echoes)
        if (isInbound) {
          const isValidSignature = await verifySignature(
            keys.publicSigningKey,
            savedMessage.signature,
            savedMessage.ciphertext,
          );
          if (!isActive) return;
          if (!isValidSignature)
            throw new Error("SECURITY ALERT: Invalid signature!");
        }

        const decryptedText = await decryptMessage(
          keys.sharedSecret,
          savedMessage.ciphertext,
          savedMessage.iv,
        );
        if (!isActive) return;

        setMessages((prev) => {
          // Deduplicate: replace optimistic entry or skip if already present
          if (prev.some((m) => m.id === savedMessage.id)) return prev;
          return [
            ...prev,
            {
              id: savedMessage.id,
              text: decryptedText,
              senderId: savedMessage.senderId,
              receiverId: savedMessage.receiverId,
              isOwnMessage: isOwnEcho,
              isVerified: true,
            },
          ];
        });
      } catch (err) {
        if (!isActive) return;
        console.error("Decryption failed:", err);
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMessage.id)) return prev;
          return [
            ...prev,
            {
              id: savedMessage.id,
              text: "\u26a0\ufe0f [Security Warning] Message could not be decrypted/verified",
              senderId: savedMessage.senderId,
              receiverId: savedMessage.receiverId,
              isOwnMessage: isOwnEcho,
              isVerified: false,
            },
          ];
        });
      }
    };

    // Server confirms: replace the optimistic tempId with the real DB id, clear pending flag
    const handleSaved = (ack: { tempId?: string; message: { id: string } }) => {
      if (!ack.tempId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === ack.tempId
            ? { ...m, id: ack.message.id, pending: false }
            : m,
        ),
      );
    };

    // Server reports failure: mark the optimistic message as failed so the UI can show it
    const handleError = (ack: { tempId?: string; error: string }) => {
      if (!ack.tempId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === ack.tempId ? { ...m, pending: false, failed: true } : m,
        ),
      );
    };

    socket.on("receiveMessage", handleReceive);
    socket.on("messageSaved", handleSaved);
    socket.on("messageError", handleError);
    return () => {
      isActive = false;
      socket.off("receiveMessage", handleReceive);
      socket.off("messageSaved", handleSaved);
      socket.off("messageError", handleError);
    };
  }, [socket, selectedContact?.id, userId]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to recalculate shrinking
      textarea.style.height = "auto";
      // Set new height based on the scrollHeight (content height)
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [inputText]);

  const handleSendMessage = async (
    e?: React.SyntheticEvent<HTMLFormElement>,
  ) => {
    if (e) e.preventDefault();
    if (
      !inputText.trim() ||
      !userId ||
      !currentUser ||
      !selectedContact ||
      !socket ||
      !ecdhPrivateKey ||
      !ecdsaPrivateKey
    )
      return;

    const textToEncrypt = inputText;
    setInputText("");

    const tempId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text: textToEncrypt,
        senderId: userId,
        receiverId: selectedContact.id,
        isOwnMessage: true,
        isVerified: true,
        pending: true,
      },
    ]);

    try {
      const keys = await getCryptoKeys(selectedContact);
      const { ciphertext, iv } = await encryptMessage(
        keys.sharedSecret,
        textToEncrypt,
      );
      const signature = await signData(ecdsaPrivateKey, ciphertext);

      socket.emit("sendMessage", {
        receiverId: selectedContact.id,
        ciphertext,
        iv,
        signature,
        tempId,
      });
    } catch (err) {
      console.error("Send error:", err);
      // Roll back the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // UI: Empty State
  if (!selectedContact) {
    return (
      <div className="flex-1 h-full bg-primary-950 ml-0 flex flex-col items-center justify-center relative overflow-hidden rounded-none md:rounded-2xl border border-primary-50 shadow-lg mr-0 md:mr-5">
        <div className="w-16 h-16 rounded-full bg-primary-900 flex items-center justify-center mb-4 border border-primary-800">
          <svg
            className="w-8 h-8 text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-primary-50">Your Secure Vault</h3>
        <p className="text-primary-400 text-sm mt-2 max-w-xs text-center">
          Select a contact to initiate an End-to-End Encrypted session.
        </p>
      </div>
    );
  }

  // Get the specific shade for the currently selected contact
  const contactColor = getContactColor(selectedContact.username);

  // UI: Active Chat Session
  return (
    <div className="flex-1 h-full bg-primary-950 ml-0 flex flex-col relative overflow-hidden md:rounded-2xl border border-primary-50 shadow-lg mr-0 md:mr-5 rounded-2xl">
      <header className="px-6 py-4 bg-primary-950 backdrop-blur-md flex items-center justify-between shrink-0 z-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden w-9 h-9 rounded-full border border-primary-700 hover:border-primary-500 text-primary-200 hover:text-primary-50 flex items-center justify-center transition-colors"
              aria-label="Back to contacts"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 18l-6-6 6-6"
                />
              </svg>
            </button>
          )}
          <div
            className={`w-10 h-10 rounded-full ${contactColor} flex items-center justify-center text-primary-50 font-bold shadow-inner`}
          >
            {selectedContact.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-primary-50">
              {selectedContact.username}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-primary-400 shadow-[0_0_5px_var(--color-primary-400)]" : "bg-secondary-700 shadow-[0_0_5px_var(--color-secondary-700)]"}`}
              ></span>
                <div
                  className={`text-xs ${isConnected ? " text-primary-400" : " text-secondary-700"}`}
                >
                  {isConnected ? "Connected" : "Reconnecting..."}
                </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-6 h-px bg-linear-to-r from-transparent via-primary-400/80 to-transparent shrink-0"></div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 z-0 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col text-primary-400">
            <span className="mb-2">🔒</span>
            <p className="text-sm">Messages are end-to-end encrypted.</p>
            <p className="text-xs mt-1 text-primary-500">
              Nobody outside of this chat can read them.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isOwnMessage ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] px-5 py-3 rounded-2xl shadow-sm wrap-break-word whitespace-pre-wrap ${
                  msg.failed
                    ? "bg-red-900/40 text-red-200 border border-red-500/30 rounded-br-none"
                    : !msg.isVerified
                      ? "bg-secondary-900/50 text-secondary-200 border border-secondary-700 rounded-bl-none"
                      : msg.isOwnMessage
                        ? `bg-primary-900 text-primary-50 rounded-br-none ${msg.pending ? "opacity-60" : ""}`
                        : `${contactColor} text-primary-50 rounded-bl-none`
                }`}
              >
                {msg.text}
                {msg.failed && (
                  <div className="text-[10px] text-red-400 mt-1 text-right">
                    Failed to send
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mx-6 h-px bg-linear-to-r from-transparent via-primary-400/80 to-transparent shrink-0"></div>
      <footer className="p-4 bg-primary-950 backdrop-blur-md shrink-0 z-0">
        <form
          onSubmit={handleSendMessage}
          // Changed to items-end so the button stays at the bottom when expanding
          className="flex gap-3 max-w-5xl mx-auto items-end"
        >
          <textarea
            ref={textareaRef} // Attach the ref here
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message here..."
            rows={1}
            className="flex-1 bg-primary-950 border border-primary-50 rounded-3xl px-6 py-3 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-primary-50 text-primary-50 text-sm shadow-inner resize-none min-h-11.5 max-h-32 overflow-y-auto hide-scrollbar"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            // Added pb-1 so it aligns perfectly with the bottom of the pill
            className="bg-primary-600 hover:bg-primary-500 disabled:shadow-none text-primary-50 font-bold px-8 py-3 rounded-full transition-all shadow-[0_0_15px_rgba(0,186,239,0.3)] flex items-center justify-center mb-0.5"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
