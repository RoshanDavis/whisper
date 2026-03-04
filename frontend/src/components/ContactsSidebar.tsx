import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getContactColor } from '../utils/contactColor';

export interface Contact {
  id: string;
  username: string;
  publicKey: string;
  publicSigningKey: string;
}

interface ContactsSidebarProps {
  selectedContact: Contact | null;
  setSelectedContact: (contact: Contact) => void;
}

export default function ContactsSidebar({ selectedContact, setSelectedContact }: ContactsSidebarProps) {
  const { userId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const resetAddContactModal = () => {
    setNewContactUsername('');
    setAddError('');
    setIsAdding(false);
  };

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();

    const fetchContacts = async () => {
      try {
        const res = await fetch('/api/auth/contacts', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error('Failed to fetch contacts');
        const data = await res.json();
        if (!controller.signal.aborted) {
          setContacts(data);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err);
        }
      }
    };
    fetchContacts();

    return () => {
      controller.abort();
    };
  }, [userId]);

  const handleAddContact = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError('');

    const trimmedUsername = newContactUsername.trim();
    if (!trimmedUsername) return;

    setIsAdding(true);

    try {
      const res = await fetch('/api/auth/contacts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUsername: trimmedUsername }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add contact');

      setContacts((prev) => [...prev, data.contact]);
      setIsAddModalOpen(false);
      resetAddContactModal();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-1/3 max-w-sm h-full bg-primary-950 border border-primary-50 rounded-xl flex flex-col relative shrink-0 ml-5">
      <div className="p-4 flex flex-col gap-4">
        <h2 className="text-primary-50 font-bold text-lg text-center mt-4 tracking-wide">Contacts</h2>
        
        {/* Updated line visibility to match ChatArea */}
        <div className="h-px w-full bg-linear-to-r from-transparent via-primary-400/80 to-transparent"></div>
        
        <div className="relative border rounded-full hover:border-primary-500 transition-colors">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-primary-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search Contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent rounded-full pl-10 pr-4 py-2 text-sm text-primary-50 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder-primary-50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1 hide-scrollbar">
        {filteredContacts.length === 0 ? (
          <div className="text-center text-sm text-primary-50 mt-6 italic">
            {contacts.length === 0 ? "Your secure vault is empty." : "No contacts found."}
          </div>
        ) : (
          filteredContacts.map(contact => {
            const contactColor = getContactColor(contact.username);
            
            return (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`w-full text-left px-3 py-3 rounded-full transition-all flex items-center gap-3 group ${
                  selectedContact?.id === contact.id 
                    ? 'bg-primary-900 border border-primary-800' 
                    : 'hover:bg-primary-900/50 border border-transparent'
                }`}
              >
                {/* 3. Apply the dynamic shade to the avatar circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-secondary-50 font-bold shadow-inner ${contactColor} transition-colors`}>
                  {contact.username.charAt(0).toUpperCase()}
                </div>
                <span className={`font-medium truncate text-primary-50`}>
                  {contact.username}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="p-4 mt-auto">
        {/* Updated line visibility to match ChatArea */}
        <div className="h-px w-full bg-linear-to-r from-transparent via-primary-400/80 to-transparent mb-4"></div>
        <button 
          onClick={() => { resetAddContactModal(); setIsAddModalOpen(true); }}
          className="w-full bg-primary-900 hover:bg-primary-800 border border-primary-800 hover:border-primary-700 text-primary-50 font-semibold py-2.5 rounded-full transition-all text-sm"
        >
          Add Contact
        </button>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {/* Fixed the bg-primary-90 typo here */}
          <div className="bg-primary-950 border border-primary-50 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-primary-50 mb-2">Add Secure Contact</h3>
            <p className="text-xs text-primary-50 mb-4">Enter your friend's exact username to exchange public keys and initiate a secure connection.</p>
            
            <form onSubmit={handleAddContact}>
              <input
                type="text"
                required
                value={newContactUsername}
                onChange={(e) => setNewContactUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-primary-950 border border-primary-50 rounded-lg px-4 py-2.5 text-sm text-primary-50 focus:outline-none focus:border-primary-500 mb-3"
              />
              
              {addError && <div className="text-xs text-secondary-400 mb-3 bg-secondary-900/30 border border-secondary-800/50 p-2 rounded">{addError}</div>}
              
              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => { resetAddContactModal(); setIsAddModalOpen(false); }}
                  className="px-4 py-2 text-sm text-primary-50 hover:text-primary-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isAdding || !newContactUsername.trim()}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-600 text-primary-50 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isAdding ? 'Verifying...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}