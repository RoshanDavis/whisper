import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Contact {
  id: string;
  username: string;
  publicKey: string;
  publicSigningKey: string;
}

interface SidebarProps {
  selectedContact: Contact | null;
  setSelectedContact: (contact: Contact) => void;
}

export default function Sidebar({ selectedContact, setSelectedContact }: SidebarProps) {
  const { userId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchContacts = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/auth/contacts/${userId}`);
        if (!res.ok) throw new Error('Failed to fetch contacts');
        const data = await res.json();
        setContacts(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchContacts();
  }, [userId]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setIsAdding(true);

    try {
      const res = await fetch('http://localhost:3000/api/auth/contacts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: userId, contactUsername: newContactUsername }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add contact');

      setContacts((prev) => [...prev, data.contact]);
      setIsAddModalOpen(false);
      setNewContactUsername('');
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
    <div className="w-1/3 max-w-sm h-full bg-vault-base border-r border-gray-700/50 flex flex-col relative shrink-0">
      <div className="p-4 flex flex-col gap-4">
        <h2 className="text-white font-bold text-lg text-center tracking-wide">Contacts</h2>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search Contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-vault-panel border border-gray-700 rounded-full pl-10 pr-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all placeholder-gray-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
        {filteredContacts.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-6 italic">
            {contacts.length === 0 ? "Your secure vault is empty." : "No contacts found."}
          </div>
        ) : (
          filteredContacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3 group ${
                selectedContact?.id === contact.id 
                  ? 'bg-vault-panel border border-gray-700' 
                  : 'hover:bg-vault-panel/50 border border-transparent'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-inner ${
                 selectedContact?.id === contact.id ? 'bg-brand' : 'bg-gray-600 group-hover:bg-gray-500'
              } transition-colors`}>
                {contact.username.charAt(0).toUpperCase()}
              </div>
              <span className={`font-medium truncate ${selectedContact?.id === contact.id ? 'text-white' : 'text-gray-300'}`}>
                {contact.username}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="p-4 mt-auto">
        <div className="h-px w-full bg-linear-to-r from-transparent via-brand/50 to-transparent mb-4"></div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-full bg-vault-panel hover:bg-vault-highlight border border-gray-600 hover:border-gray-500 text-white font-semibold py-2.5 rounded-full transition-all text-sm"
        >
          Add Contact
        </button>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vault-panel border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Add Secure Contact</h3>
            <p className="text-xs text-gray-400 mb-4">Enter your friend's exact username to exchange public keys and initiate a secure connection.</p>
            
            <form onSubmit={handleAddContact}>
              <input
                type="text"
                required
                value={newContactUsername}
                onChange={(e) => setNewContactUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-vault-base border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-brand mb-3"
              />
              
              {addError && <div className="text-xs text-red-400 mb-3 bg-red-400/10 p-2 rounded">{addError}</div>}
              
              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isAdding || !newContactUsername.trim()}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
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