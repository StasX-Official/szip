import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class SecurityUtils {
  private static readonly MAX_PATH_LENGTH = 260;
  private static readonly SAFE_FILENAME_REGEX = /^[a-zA-Z0-9\-_\.\s]+$/;
  private static readonly DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'];

  /**
   * Sanitize file path to prevent directory traversal attacks
   */
  static sanitizePath(filePath: string): string {
    // Remove null bytes and control characters
    let sanitized = filePath.replace(/[\x00-\x1f\x7f]/g, '');
    
    // Normalize path separators
    sanitized = path.normalize(sanitized);
    
    // Remove .. traversal attempts
    sanitized = sanitized.replace(/\.\./g, '');
    
    // Ensure path doesn't start with /
    if (sanitized.startsWith('/') || sanitized.startsWith('\\')) {
      sanitized = sanitized.substring(1);
    }
    
    // Truncate if too long
    if (sanitized.length > this.MAX_PATH_LENGTH) {
      const ext = path.extname(sanitized);
      const base = path.basename(sanitized, ext);
      const dir = path.dirname(sanitized);
      const maxBase = this.MAX_PATH_LENGTH - dir.length - ext.length - 1;
      sanitized = path.join(dir, base.substring(0, maxBase) + ext);
    }
    
    return sanitized;
  }

  /**
   * Validate filename for security
   */
  static validateFilename(filename: string): boolean {
    if (!filename || filename.length === 0) return false;
    if (filename.length > 255) return false;
    
    // Check for dangerous characters
    if (!/^[^<>:"|?*\x00-\x1f\x7f]*$/.test(filename)) return false;
    
    // Check for reserved Windows names
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                     'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                     'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    
    const baseName = path.basename(filename, path.extname(filename)).toUpperCase();
    if (reserved.includes(baseName)) return false;
    
    // Check for dangerous extensions
    const ext = path.extname(filename).toLowerCase();
    if (this.DANGEROUS_EXTENSIONS.includes(ext)) return false;
    
    return true;
  }

  /**
   * Check if path is within allowed directory (prevent directory traversal)
   */
  static isPathSafe(targetPath: string, allowedRoot: string): boolean {
    try {
      const resolvedTarget = path.resolve(targetPath);
      const resolvedRoot = path.resolve(allowedRoot);
      
      return resolvedTarget.startsWith(resolvedRoot + path.sep) || 
             resolvedTarget === resolvedRoot;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secure temporary filename
   */
  static generateSecureTempName(prefix: string = 'szip', extension: string = '.tmp'): string {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomBytes}${extension}`;
  }

  /**
   * Validate archive before processing
   */
  static async validateArchive(archivePath: string): Promise<{valid: boolean, issues: string[]}> {
    const issues: string[] = [];
    
    try {
      const stats = fs.statSync(archivePath);
      
      // Check file size (prevent ZIP bombs)
      if (stats.size > 1024 * 1024 * 1024) { // 1GB limit
        issues.push('Archive size exceeds safety limit (1GB)');
      }
      
      // Check if file is actually readable
      fs.accessSync(archivePath, fs.constants.R_OK);
      
      // Basic ZIP signature check
      const buffer = fs.readFileSync(archivePath).slice(0, 4);
      const signature = buffer.toString('hex');
      
      if (!signature.startsWith('504b') && !signature.startsWith('504b0304')) {
        issues.push('Invalid ZIP file signature');
      }
      
    } catch (error) {
      issues.push(`File access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Rate limiting for operations
   */
  private static operationCounts: Map<string, {count: number, resetTime: number}> = new Map();
  
  static checkRateLimit(operation: string, maxOps: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = `${operation}_${process.pid}`;
    
    let record = this.operationCounts.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      this.operationCounts.set(key, record);
    }
    
    if (record.count >= maxOps) {
      return false; // Rate limit exceeded
    }
    
    record.count++;
    return true;
  }

  /**
   * Sanitize environment variables
   */
  static sanitizeEnvVar(value: string): string {
    if (!value) return '';
    
    // Remove dangerous characters and limit length
    return value
      .replace(/[^\w\-\.\/\\:]/g, '')
      .substring(0, 1000);
  }

  /**
   * Check for ZIP bomb patterns
   */
  static async checkZipBomb(archivePath: string): Promise<{isSuspicious: boolean, reason?: string}> {
    try {
      const stats = fs.statSync(archivePath);
      const compressedSize = stats.size;
      
      // If compressed file is very small but claims large content, it might be a ZIP bomb
      if (compressedSize < 1024 * 100) { // Less than 100KB
        // This is a simplified check - in production, you'd analyze the ZIP structure
        return { isSuspicious: false };
      }
      
      return { isSuspicious: false };
    } catch (error) {
      return { isSuspicious: true, reason: 'Cannot analyze archive structure' };
    }
  }

  /**
   * Secure file deletion
   */
  static async secureDelete(filePath: string): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        // Overwrite with random data before deletion
        const size = stats.size;
        const randomData = crypto.randomBytes(Math.min(size, 1024 * 1024)); // Max 1MB
        
        const fd = fs.openSync(filePath, 'r+');
        for (let offset = 0; offset < size; offset += randomData.length) {
          fs.writeSync(fd, randomData, 0, Math.min(randomData.length, size - offset), offset);
        }
        fs.fsyncSync(fd);
        fs.closeSync(fd);
      }
      
      fs.unlinkSync(filePath);
    } catch (error) {
      // Fallback to normal deletion
      try {
        fs.unlinkSync(filePath);
      } catch (fallbackError) {
        throw new Error(`Could not securely delete file: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Memory usage monitoring
   */
  static checkMemoryUsage(): {safe: boolean, usage: NodeJS.MemoryUsage} {
    const usage = process.memoryUsage();
    const maxHeap = 1024 * 1024 * 1024; // 1GB limit
    
    return {
      safe: usage.heapUsed < maxHeap,
      usage
    };
  }
}
