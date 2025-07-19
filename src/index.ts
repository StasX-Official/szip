import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import * as yauzl from 'yauzl';
import { Logger } from './logger';
import { CryptoUtils, HashAlgorithm } from './crypto';

export interface ZipOptions {
  password?: string;
  compressionLevel?: number;
  generateHash?: HashAlgorithm;
  excludePatterns?: string[];
  includeHidden?: boolean;
}

export interface ZipResult {
  outputPath: string;
  size: number;
  directory: string;
  hash?: string;
  hashAlgorithm?: HashAlgorithm;
  compressionRatio?: number;
  fileCount?: number;
}

export interface UnzipResult {
  directory: string;
}

export class SimplZip {
  static async zip(sourcePath: string, outputPath: string, options: ZipOptions = {}): Promise<ZipResult> {
    const source = path.resolve(sourcePath);
    const output = path.resolve(outputPath);
    
    if (!fs.existsSync(source)) {
      throw new Error(`Source path does not exist: ${source}`);
    }

    if (options.password && typeof options.password === 'string') {
      const validation = CryptoUtils.validatePasswordStrength(options.password);
      if (!validation.isStrong) {
        Logger.warn(102, `Weak password: ${validation.feedback.slice(0, 2).join(', ')}`);
      }
    }

    let fileCount = 0;
    const originalSize = this.calculateDirectorySize(source);

    return new Promise((resolve, reject) => {
      const outputStream = fs.createWriteStream(output);
      const archive = archiver('zip', {
        zlib: { level: options.compressionLevel || 9 }
      });

      if (options.password && typeof options.password === 'string') {
        Logger.info('🔒 Adding password protection...');
        const passwordHash = CryptoUtils.generatePasswordHash(options.password);
        archive.comment = `SZIP_PASSWORD_PROTECTED:${passwordHash}`;
      }

      outputStream.on('close', async () => {
        try {
          const stats = fs.statSync(output);
          const compressionRatio = originalSize > 0 ? ((originalSize - stats.size) / originalSize) * 100 : 0;
          
          let hash: string | undefined;
          let hashAlgorithm: HashAlgorithm | undefined;
          
          if (options.generateHash && typeof options.generateHash === 'string') {
            Logger.info(`🔐 Generating ${options.generateHash.toUpperCase()} hash...`);
            const hashResult = await CryptoUtils.generateFileHash(output, options.generateHash);
            hash = hashResult.hash;
            hashAlgorithm = hashResult.algorithm;
          }
          
          resolve({
            outputPath: output,
            size: stats.size,
            directory: path.dirname(output),
            hash,
            hashAlgorithm,
            compressionRatio: Math.round(compressionRatio * 100) / 100,
            fileCount
          });
        } catch (error) {
          reject(error);
        }
      });

      archive.on('error', (err: any) => reject(err));
      
      archive.on('entry', () => fileCount++);
      
      archive.pipe(outputStream);

      const stat = fs.statSync(source);
      if (stat.isDirectory()) {
        archive.directory(source, path.basename(source));
      } else {
        archive.file(source, { name: path.basename(source) });
        fileCount = 1;
      }

      archive.finalize();
    });
  }

  static async unzip(zipPath: string, outputPath?: string, password?: string): Promise<UnzipResult> {
    const zipFile = path.resolve(zipPath);
    const extractTo = outputPath ? path.resolve(outputPath) : path.dirname(zipFile);

    if (!fs.existsSync(zipFile)) {
      throw new Error(`ZIP file does not exist: ${zipFile}`);
    }

    const isPasswordProtected = await this.checkPasswordProtection(zipFile);
    if (isPasswordProtected && !password) {
      throw new Error('Archive is password protected. Provide password using -p flag');
    }

    return new Promise((resolve, reject) => {
      yauzl.open(zipFile, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        if (!zipfile) return reject(new Error('Failed to open ZIP file'));

        if (password && zipfile.comment) {
          const commentParts = zipfile.comment.split('SZIP_PASSWORD_PROTECTED:');
          if (commentParts.length === 2) {
            const storedHash = commentParts[1];
            if (storedHash && !CryptoUtils.verifyPassword(password, storedHash)) {
              return reject(new Error('Incorrect password'));
            }
            Logger.info('🔓 Password verified');
          }
        }

        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          const entryPath = path.join(extractTo, entry.fileName);
          
          if (!this.isPathSafe(entryPath, extractTo)) {
            Logger.warn(103, `Skipping unsafe path: ${entry.fileName}`);
            zipfile.readEntry();
            return;
          }
          
          if (/\/$/.test(entry.fileName)) {
            fs.mkdirSync(entryPath, { recursive: true });
            zipfile.readEntry();
          } else {
            fs.mkdirSync(path.dirname(entryPath), { recursive: true });
            
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              if (!readStream) return reject(new Error('Failed to read entry'));

              const writeStream = fs.createWriteStream(entryPath);
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => zipfile.readEntry());
              writeStream.on('error', reject);
            });
          }
        });

        zipfile.on('end', () => {
          resolve({ directory: extractTo });
        });

        zipfile.on('error', reject);
      });
    });
  }

  private static async checkPasswordProtection(zipPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          resolve(false);
          return;
        }
        
        const isProtected = zipfile.comment?.includes('SZIP_PASSWORD_PROTECTED:') || false;
        zipfile.close();
        resolve(isProtected);
      });
    });
  }

  private static calculateDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    try {
      const traverse = (currentPath: string) => {
        const stats = fs.statSync(currentPath);
        if (stats.isDirectory()) {
          const items = fs.readdirSync(currentPath);
          items.forEach(item => {
            traverse(path.join(currentPath, item));
          });
        } else {
          totalSize += stats.size;
        }
      };
      
      traverse(dirPath);
    } catch (error) {
      Logger.warn(104, `Could not calculate directory size: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return totalSize;
  }

  private static isPathSafe(targetPath: string, allowedRoot: string): boolean {
    try {
      const resolvedTarget = path.resolve(targetPath);
      const resolvedRoot = path.resolve(allowedRoot);
      
      return resolvedTarget.startsWith(resolvedRoot + path.sep) || 
             resolvedTarget === resolvedRoot;
    } catch (error) {
      return false;
    }
  }

  static formatSize(bytes: number): string {
    if (typeof bytes !== 'number' || bytes < 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}
