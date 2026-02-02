import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.APP_SECRET || 'default-secret-change-in-production';

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
}

export function decrypt(encryptedText: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // Check if decryption was successful (empty string usually means wrong key or corrupted data)
    if (!decrypted || decrypted.length === 0) {
      throw new Error('Decryption failed: Empty result. This usually means the encryption key (APP_SECRET) has changed or the data is corrupted.');
    }
    
    return decrypted;
  } catch (error: any) {
    // If it's already our custom error, re-throw it
    if (error.message && error.message.includes('Decryption failed')) {
      throw error;
    }
    // Otherwise, wrap the original error
    throw new Error(`Decryption failed: ${error.message || 'Malformed UTF-8 data'}. This usually means the encryption key (APP_SECRET) has changed or the data is corrupted. User may need to re-authenticate.`);
  }
}

