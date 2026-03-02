import { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea'; // <-- 1. Import it

export default function Chat() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] font-sans">
      <Navbar />
      
      <div className="flex flex-1 overflow-hidden h-full">
        <Sidebar 
          selectedContact={selectedContact} 
          setSelectedContact={setSelectedContact} 
        />
        
        {/* 2. Replace the placeholder with the real component! */}
        <ChatArea selectedContact={selectedContact} />
      </div>
    </div>
  );
}