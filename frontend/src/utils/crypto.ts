// frontend/src/utils/crypto.ts

/**
 * Helper function: Converts a raw memory ArrayBuffer into a Base64 string
 * so we can easily save it to Supabase or the browser's localStorage.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 1. Generate an ECDH Key Pair on the P-256 curve.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // Set to true so we can extract and save the keys
    ['deriveKey', 'deriveBits'] // The operations these keys are allowed to perform
  );

  return keyPair;
}

/**
 * 2. Export the Public Key to a Base64 string (to send to the backend)
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * 3. Export the Private Key to a Base64 string (to save securely in the browser)
 * * Note: For maximum security in production pipelines, private keys are often stored 
 * non-extractable in IndexedDB, but Base64 in localStorage is standard for initial setup.
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('pkcs8', key);
  return arrayBufferToBase64(exported);
}

/**
 * Helper function: Converts a Base64 string back into a raw memory ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 4. Import the Base64 Public Key back into a CryptoKey
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * 5. Import the Base64 Private Key back into a CryptoKey
 */
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * 6. Derive the Shared AES-256-GCM Secret
 * This mathematically combines Your Private Key + Their Public Key
 */
export async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * 7. Encrypt the plaintext message
 * Returns the ciphertext and the IV (Initialization Vector) as Base64 strings
 */
export async function encryptMessage(sharedKey: CryptoKey, plaintext: string): Promise<{ ciphertext: string, iv: string }> {
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plaintext);
  
  // AES-GCM requires a random 96-bit (12 byte) Initialization Vector for every single message
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); 

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    encodedText
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

/**
 * 8. Decrypt the incoming ciphertext
 */
export async function decryptMessage(sharedKey: CryptoKey, ciphertextBase64: string, ivBase64: string): Promise<string> {
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
  const ivBuffer = base64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    sharedKey,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}