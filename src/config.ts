import * as fs from 'fs';
import * as path from 'path';
import { Platform } from './platform';

export interface SZipConfig {
  defaultCompressionLevel: number;
  defaultOutputDirectory: string;
  theme: 'dark' | 'light' | 'auto';
  language: 'uk' | 'en' | 'auto';
  showProgress: boolean;
  autoCleanup: boolean;
  maxMemoryUsage: string;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: SZipConfig;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(Platform.getConfigDirectory(), 'config.json');
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getDefaultConfig(): SZipConfig {
    return {
      defaultCompressionLevel: 9,
      defaultOutputDirectory: process.cwd(),
      theme: 'auto',
      language: 'auto',
      showProgress: true,
      autoCleanup: true,
      maxMemoryUsage: '1GB'
    };
  }

  private loadConfig(): SZipConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        return { ...this.getDefaultConfig(), ...JSON.parse(configData) };
      }
    } catch (error) {
    }
    return this.getDefaultConfig();
  }

  saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.warn('Could not save configuration:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  get<K extends keyof SZipConfig>(key: K): SZipConfig[K] {
    return this.config[key];
  }

  set<K extends keyof SZipConfig>(key: K, value: SZipConfig[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }
}
