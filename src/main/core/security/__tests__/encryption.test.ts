jest.mock('../../logger/Logger');

import { encryptToken, decryptToken, generateState, generateCodeVerifier, EncryptedData } from '../encryption';
import crypto from 'crypto';

describe('Security Encryption Module', () => {
  describe('AES-256-GCM Envelope Encryption', () => {
    it('应该成功加密并解密 Token (闭环验证)', () => {
      const originalToken = 'my_super_secret_oauth_token_12345';
      const encrypted = encryptToken(originalToken);
      expect(encrypted.encryptedData).not.toBe(originalToken);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('如果业务数据 authTag 被篡改，解密应抛出异常', () => {
      const originalToken = 'tamper_test_token';
      const encrypted = encryptToken(originalToken);
      // Generate a valid 16-byte auth tag (base64 encoded = 24 chars)
      const tamperedEncrypted: EncryptedData = { ...encrypted, authTag: crypto.randomBytes(16).toString('base64') };
      expect(() => decryptToken(tamperedEncrypted)).toThrow('Failed to decrypt token');
    });
  });

  describe('OAuth2 PKCE & State Generators', () => {
    it('generateState 应生成 64 字符的 hex 字符串', () => {
      expect(generateState()).toHaveLength(64);
    });
    it('generateCodeVerifier 应生成 base64url 字符串', () => {
      expect(generateCodeVerifier()).toHaveLength(43);
    });
  });
});
