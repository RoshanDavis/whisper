import { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/ContactsSidebar';
import ChatArea from '../components/ChatArea';

export default function Chat() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  return (
    <div className="flex flex-col h-screen bg-primary-950 font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden gap-3">
        <Sidebar 
          selectedContact={selectedContact} 
          setSelectedContact={setSelectedContact} 
        />
        <ChatArea selectedContact={selectedContact} />
      </div>
    </div>
  );
}