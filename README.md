# whisper
Whisper: A Real-Time End-to-End Encrypted Communication Platform    

Whisper is a real-time web chat application that is designed to protect the user’s privacy through 
end-to-end encryption. It will be built using the PERN stack with WebSockets. The backend 
server will be designed to only route the data and will not be able to read the conversations. The 
encryption and decryption will be handled directly inside the users’ browsers. This means only 
the users will have access to the plaintext. The application will use the ECDH algorithm for an 
asymmetric key exchange to agree on a shared key. It will then use the shared key for 
AES-256-GCM to encrypt and decrypt the messages.  
