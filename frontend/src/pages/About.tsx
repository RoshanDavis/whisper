import Navbar from '../components/Navbar';

export default function About() {
  return (
    <div className="flex flex-col h-screen bg-primary-950 font-sans">
      <Navbar />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-primary-900 border border-primary-800 rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-secondary-500"></div>
          
          <div className="w-16 h-16 rounded-full bg-primary-800 flex items-center justify-center mx-auto mb-6 border border-primary-700">
            <svg className="w-8 h-8 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-primary-50 mb-4 tracking-wide">About Whisper</h2>
          <p className="text-primary-300 text-sm leading-relaxed">
            Whisper is a Zero-Knowledge End-to-End Encrypted messaging protocol. Messages are secured using AES-GCM and authenticated with ECDSA signatures before ever leaving your device.
          </p>
        </div>
      </div>
    </div>
  );
}