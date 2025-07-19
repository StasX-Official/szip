import * as os from 'os';
import * as path from 'path';

export class Platform {
  static get isWindows(): boolean {
    return process.platform === 'win32';
  }

  static get isMacOS(): boolean {
    return process.platform === 'darwin';
  }

  static get isLinux(): boolean {
    return process.platform === 'linux';
  }

  static get homeDirectory(): string {
    return os.homedir();
  }

  static get tempDirectory(): string {
    return os.tmpdir();
  }

  static get pathSeparator(): string {
    return path.sep;
  }

  static normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  static getConfigDirectory(): string {
    if (this.isWindows) {
      return path.join(process.env.APPDATA || this.homeDirectory, 'szip');
    } else if (this.isMacOS) {
      return path.join(this.homeDirectory, 'Library', 'Application Support', 'szip');
    } else {
      return path.join(process.env.XDG_CONFIG_HOME || path.join(this.homeDirectory, '.config'), 'szip');
    }
  }

  static getExecutableExtension(): string {
    return this.isWindows ? '.exe' : '';
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
