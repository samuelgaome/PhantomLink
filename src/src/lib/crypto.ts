import { ethers } from 'ethers';

function deriveKey(address: string) {
  const normalized = ethers.getAddress(address).toLowerCase();
  const hash = ethers.keccak256(ethers.toUtf8Bytes(normalized));
  return ethers.getBytes(hash);
}

export function encryptMessageWithAddress(message: string, address: string): string {
  const keyBytes = deriveKey(address);
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  const encrypted = messageBytes.map((value, idx) => value ^ keyBytes[idx % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

export function decryptMessageWithAddress(ciphertext: string, address: string): string {
  const keyBytes = deriveKey(address);
  const encryptedBytes = Uint8Array.from(atob(ciphertext), (char) => char.charCodeAt(0));
  const decrypted = encryptedBytes.map((value, idx) => value ^ keyBytes[idx % keyBytes.length]);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
