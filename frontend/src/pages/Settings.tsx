import Navbar from '../components/Navbar';

export default function Settings() {
  return (
    <div className="flex flex-col h-screen bg-primary-950 font-sans">
      <Navbar />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-primary-900 border border-primary-800 rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
          {/* Subtle top glow matching your theme */}
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary-400 to-secondary-500"></div>
          
          <div className="w-16 h-16 rounded-full bg-primary-800 flex items-center justify-center mx-auto mb-6 border border-primary-700">
            <svg className="w-8 h-8 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-primary-50 mb-4 tracking-wide">Security Settings</h2>
          <p className="text-primary-300 text-sm leading-relaxed">
            This is where we will build the interface to manage your cryptographic keys, view safety numbers, and handle Perfect Forward Secrecy rotation.
          </p>
        </div>
      </div>
    </div>
  );
}