import crypto from "crypto";
import { envs } from "./env";

export class EncryptionService {
  private static algorithm = "aes-256-cbc";
  
  // Usamos JWT_SEED (o una fallback si es muy corto) y generamos un hash SHA-256 exacto de 32 bytes
  private static getKey(): Buffer {
    const secret = envs.JWT_SEED || "fallback-secret-for-encryption-atucucho";
    return crypto.createHash("sha256").update(String(secret)).digest();
  }

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  static decrypt(text: string): string {
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift() as string, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.getKey(), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      console.error("[EncryptionService] Decryption failed:", error);
      return "ERROR_DECRYPTING";
    }
  }
}
