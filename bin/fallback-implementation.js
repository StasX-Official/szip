const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const yauzl = require('yauzl');

class SimplZip {
  static async zip(sourcePath, outputPath, options = {}) {
    const source = path.resolve(sourcePath);
    const output = path.resolve(outputPath);
    
    if (!fs.existsSync(source)) {
      throw new Error(`Source path does not exist: ${source}`);
    }

    return new Promise((resolve, reject) => {
      const outputStream = fs.createWriteStream(output);
      const archive = archiver('zip', {
        zlib: { level: options.compressionLevel || 9 }
      });

      let fileCount = 0;

      outputStream.on('close', () => {
        try {
          const stats = fs.statSync(output);
          resolve({
            outputPath: output,
            size: stats.size,
            directory: path.dirname(output),
            compressionRatio: 0,
            fileCount: fileCount
          });
        } catch (error) {
          reject(error);
        }
      });

      outputStream.on('error', reject);
      archive.on('error', reject);
      archive.on('entry', () => fileCount++);
      
      archive.pipe(outputStream);

      try {
        const stat = fs.statSync(source);
        if (stat.isDirectory()) {
          archive.directory(source, path.basename(source));
        } else {
          archive.file(source, { name: path.basename(source) });
          fileCount = 1;
        }

        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  static async unzip(zipPath, outputPath, password) {
    const zipFile = path.resolve(zipPath);
    const extractTo = outputPath ? path.resolve(outputPath) : path.dirname(zipFile);

    if (!fs.existsSync(zipFile)) {
      throw new Error(`ZIP file does not exist: ${zipFile}`);
    }

    return new Promise((resolve, reject) => {
      yauzl.open(zipFile, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        if (!zipfile) return reject(new Error('Failed to open ZIP file'));

        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          const entryPath = path.join(extractTo, entry.fileName);
          
          if (!this.isPathSafe(entryPath, extractTo)) {
            console.warn(`Skipping unsafe path: ${entry.fileName}`);
            zipfile.readEntry();
            return;
          }
          
          if (/\/$/.test(entry.fileName)) {
            try {
              fs.mkdirSync(entryPath, { recursive: true });
              zipfile.readEntry();
            } catch (error) {
              return reject(error);
            }
          } else {
            try {
              fs.mkdirSync(path.dirname(entryPath), { recursive: true });
            } catch (error) {
              return reject(error);
            }
            
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

  static isPathSafe(targetPath, allowedRoot) {
    try {
      const resolvedTarget = path.resolve(targetPath);
      const resolvedRoot = path.resolve(allowedRoot);
      
      return resolvedTarget.startsWith(resolvedRoot + path.sep) || 
             resolvedTarget === resolvedRoot;
    } catch (error) {
      return false;
    }
  }
}

module.exports = SimplZip;
