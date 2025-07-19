import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512' | 'blake2b256' | 'blake2b512';

export interface HashResult {
  algorithm: HashAlgorithm;
  hash: string;
  fileSize: number;
  fileName: string;
  computeTime: number;
}

export interface PasswordOptions {
  algorithm?: string;
  keyLength?: number;
  iterations?: number;
  salt?: Buffer;
}

export interface EncryptionResult {
  encrypted: Buffer;
  salt: Buffer;
  iv: Buffer;
  tag: Buffer;
  algorithm: string;
}

export interface PasswordStrength {
  score: number;
  feedback: string[];
  isStrong: boolean;
  isVeryStrong: boolean;
  entropy: number;
}

export class CryptoUtils {
  private static readonly SUPPORTED_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
  
  /**
   * Generate hash for file with progress tracking
   */
  static async generateFileHash(
    filePath: string, 
    algorithm: HashAlgorithm = 'sha256',
    progressCallback?: (progress: number) => void
  ): Promise<HashResult> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
      let fileSize = 0;
      let processedBytes = 0;
      
      // Get total file size for progress calculation
      const stats = fs.statSync(filePath);
      const totalSize = stats.size;

      stream.on('data', (data) => {
        hash.update(data);
        processedBytes += data.length;
        fileSize += data.length;
        
        if (progressCallback && totalSize > 0) {
          const progress = Math.round((processedBytes / totalSize) * 100);
          progressCallback(progress);
        }
      });

      stream.on('end', () => {
        const computeTime = Date.now() - startTime;
        resolve({
          algorithm,
          hash: hash.digest('hex'),
          fileSize,
          fileName: path.basename(filePath),
          computeTime
        });
      });

      stream.on('error', reject);
    });
  }

  /**
   * Generate multiple hashes for file
   */
  static async generateMultipleHashes(
    filePath: string, 
    algorithms: HashAlgorithm[]
  ): Promise<HashResult[]> {
    const results: HashResult[] = [];
    
    for (const algorithm of algorithms) {
      const result = await this.generateFileHash(filePath, algorithm);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Verify file against hash
   */
  static async verifyFileHash(
    filePath: string, 
    expectedHash: string, 
    algorithm: HashAlgorithm = 'sha256'
  ): Promise<boolean> {
    const result = await this.generateFileHash(filePath, algorithm);
    return result.hash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Generate secure password hash with salt
   */
  static generatePasswordHash(password: string, salt?: string, iterations: number = 100000): string {
    const saltToUse = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, saltToUse, iterations, 64, 'sha512');
    return `pbkdf2_sha512$${iterations}$${saltToUse}$${hash.toString('hex')}`;
  }

  /**
   * Verify password against hash
   */
  static verifyPassword(password: string, hash: string): boolean {
    try {
      const parts = hash.split('$');
      if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha512') {
        return false;
      }
      
      const iterations = parseInt(parts[1] || '100000');
      const salt = parts[2];
      const originalHash = parts[3];
      
      const hashToVerify = crypto.pbkdf2Sync(password, salt || '', iterations, 64, 'sha512');
      return originalHash === hashToVerify.toString('hex');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate encryption key from password
   */
  static deriveKeyFromPassword(password: string, salt: Buffer, options: PasswordOptions = {}): Buffer {
    const keyLength = options.keyLength || 32;
    const iterations = options.iterations || 100000;
    const algorithm = options.algorithm || 'sha256';
    
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, algorithm);
  }

  /**
   * Encrypt data with password using AES-256-GCM
   */
  static encryptWithPassword(data: Buffer, password: string): EncryptionResult {
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const key = this.deriveKeyFromPassword(password, salt);
    
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setAAD(Buffer.from('SZIP_ENCRYPTED_DATA'));
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt,
      iv,
      tag,
      algorithm: 'aes-256-gcm'
    };
  }

  /**
   * Decrypt data with password
   */
  static decryptWithPassword(encryptionResult: EncryptionResult, password: string): Buffer {
    const key = this.deriveKeyFromPassword(password, encryptionResult.salt);
    
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAAD(Buffer.from('SZIP_ENCRYPTED_DATA'));
    decipher.setAuthTag(encryptionResult.tag);
    
    return Buffer.concat([
      decipher.update(encryptionResult.encrypted),
      decipher.final()
    ]);
  }

  /**
   * Generate cryptographically secure password
   */
  static generateSecurePassword(
    length: number = 16, 
    options: {
      includeUppercase?: boolean;
      includeLowercase?: boolean;
      includeNumbers?: boolean;
      includeSymbols?: boolean;
      excludeSimilar?: boolean;
    } = {}
  ): string {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: false
    };
    
    const opts = { ...defaults, ...options };
    
    let charset = '';
    if (opts.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.includeNumbers) charset += '0123456789';
    if (opts.includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (opts.excludeSimilar) {
      charset = charset.replace(/[il1Lo0O]/g, '');
    }
    
    if (!charset) {
      throw new Error('No character types selected for password generation');
    }
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(crypto.randomInt(0, charset.length));
    }
    
    return password;
  }

  /**
   * Enhanced password strength validation
   */
  static validatePasswordStrength(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;
    
    // Length checks
    if (password.length >= 8) score += 1;
    else feedback.push('Пароль повинен містити принаймні 8 символів');
    
    if (password.length >= 12) score += 1;
    else if (password.length >= 8) feedback.push('Для кращої безпеки використовуйте принаймні 12 символів');
    
    if (password.length >= 16) score += 1;
    
    // Character variety checks
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Додайте великі літери (A-Z)');
    
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Додайте малі літери (a-z)');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Додайте цифри (0-9)');
    
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Додайте спеціальні символи (!@#$%^&*)');
    
    // Pattern checks
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push('Уникайте повторюваних символів');
    
    if (!/^(.{2,}?)\1+$/.test(password)) score += 1;
    else feedback.push('Уникайте повторюваних послідовностей');
    
    // Calculate entropy
    const charsetSize = this.calculateCharsetSize(password);
    const entropy = Math.log2(Math.pow(charsetSize, password.length));
    
    if (entropy >= 50) score += 1;
    if (entropy >= 75) score += 1;
    
    const isStrong = score >= 7;
    const isVeryStrong = score >= 9;
    
    return {
      score,
      feedback,
      isStrong,
      isVeryStrong,
      entropy: Math.round(entropy * 100) / 100
    };
  }

  /**
   * Calculate charset size for entropy calculation
   */
  private static calculateCharsetSize(password: string): number {
    let size = 0;
    
    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/[0-9]/.test(password)) size += 10;
    if (/[^A-Za-z0-9]/.test(password)) size += 32; // Approximate special chars
    
    return size;
  }

  /**
   * Generate hash for string
   */
  static hashString(data: string, algorithm: HashAlgorithm = 'sha256'): string {
    return crypto.createHash(algorithm).update(data, 'utf8').digest('hex');
  }

  /**
   * Generate HMAC for data
   */
  static generateHMAC(data: string | Buffer, key: string, algorithm: string = 'sha256'): string {
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  static verifyHMAC(data: string | Buffer, key: string, expectedHMAC: string, algorithm: string = 'sha256'): boolean {
    const calculatedHMAC = this.generateHMAC(data, key, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHMAC, 'hex'),
      Buffer.from(expectedHMAC, 'hex')
    );
  }

  /**
   * Get list of supported hash algorithms
   */
  static getSupportedAlgorithms(): HashAlgorithm[] {
    return [...this.SUPPORTED_ALGORITHMS] as HashAlgorithm[];
  }
}
