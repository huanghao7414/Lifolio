// Supply the WebCrypto operations used by Supabase PKCE through Expo's native APIs.
import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

if (Platform.OS !== 'web') {
  const existing = globalThis.crypto;
  const digest = async (algorithm: AlgorithmIdentifier, input: BufferSource): Promise<ArrayBuffer> => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
    if (name.toUpperCase() !== 'SHA-256') throw new Error('Unsupported digest algorithm');
    const bytes = ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input);
    return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues: existing?.getRandomValues?.bind(existing) ?? ExpoCrypto.getRandomValues,
    randomUUID: existing?.randomUUID?.bind(existing) ?? ExpoCrypto.randomUUID,
    subtle: existing?.subtle ?? { digest },
  } });
}
