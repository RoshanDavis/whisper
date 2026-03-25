import { useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/ContactsSidebar";
import ChatArea from "../components/ChatArea";
import type { Contact } from "../components/ContactsSidebar";

export default function Chat() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  return (
    <div className="flex flex-col h-screen bg-primary-950 font-sans">
      <Navbar />
      <div className="hidden md:flex flex-1 overflow-hidden gap-3">
        <Sidebar
          selectedContact={selectedContact}
          setSelectedContact={setSelectedContact}
        />
        <ChatArea selectedContact={selectedContact} />
      </div>

      <div className="flex md:hidden flex-1 overflow-hidden">
        {!selectedContact ? (
          <Sidebar
            selectedContact={selectedContact}
            setSelectedContact={setSelectedContact}
          />
        ) : (
          <ChatArea
            selectedContact={selectedContact}
            onBack={() => setSelectedContact(null)}
          />
        )}
      </div>
    </div>
  );
}
