const chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';
import { Platform } from './platform';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LoggerOptions {
  level?: LogLevel;
  outputFile?: string;
  colorOutput?: boolean;
  timestamp?: boolean;
  includeStack?: boolean;
}

export class Logger {
  private static instance: Logger;
  private options: Required<LoggerOptions>;
  private logFile?: fs.WriteStream;

  private constructor(options: LoggerOptions = {}) {
    this.options = {
      level: LogLevel.INFO,
      outputFile: '',
      colorOutput: process.stdout.isTTY,
      timestamp: true,
      includeStack: false,
      ...options
    };

    if (this.options.outputFile) {
      this.initializeLogFile();
    }
  }

  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  static configure(options: LoggerOptions): void {
    Logger.instance = new Logger(options);
  }

  private initializeLogFile(): void {
    try {
      const logDir = path.dirname(this.options.outputFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      this.logFile = fs.createWriteStream(this.options.outputFile, { flags: 'a' });
    } catch (error) {
      console.warn('Could not initialize log file:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private formatMessage(level: string, code: number, message: string): string {
    const timestamp = this.options.timestamp ? `[${new Date().toISOString()}] ` : '';
    return `${timestamp}${level}: ~code:${code} > ${message}`;
  }

  private writeToFile(message: string): void {
    if (this.logFile) {
      this.logFile.write(message + '\n');
    }
  }

  private log(level: LogLevel, levelName: string, color: (text: string) => string, code: number, message: string): void {
    if (level < this.options.level) return;

    const formattedMessage = this.formatMessage(levelName, code, message);
    const coloredMessage = this.options.colorOutput ? color(formattedMessage) : formattedMessage;
    
    if (level >= LogLevel.ERROR) {
      console.error(coloredMessage);
    } else {
      console.log(coloredMessage);
    }
    
    this.writeToFile(formattedMessage);

    // Add stack trace for errors if enabled
    if (this.options.includeStack && level >= LogLevel.ERROR) {
      const stack = new Error().stack?.split('\n').slice(2).join('\n');
      if (stack) {
        const stackMessage = `Stack trace:\n${stack}`;
        console.error(this.options.colorOutput ? chalk.gray(stackMessage) : stackMessage);
        this.writeToFile(stackMessage);
      }
    }
  }

  static debug(code: number, message: string): void {
    Logger.getInstance().log(LogLevel.DEBUG, 'DEBUG', chalk.blue, code, message);
  }

  static info(message: string): void {
    if (Logger.getInstance().options.colorOutput) {
      console.log(chalk.white(message));
    } else {
      console.log(message);
    }
    Logger.getInstance().writeToFile(`INFO: ${message}`);
  }

  static success(code: number, message: string): void {
    const formattedMessage = `[${code}] ✅ ${message}`;
    console.log(Logger.getInstance().options.colorOutput ? chalk.green(formattedMessage) : formattedMessage);
    Logger.getInstance().writeToFile(`SUCCESS: ~code:${code} > ${message}`);
  }

  static warn(code: number, message: string): void {
    Logger.getInstance().log(LogLevel.WARN, 'WARN', chalk.yellow, code, message);
  }

  static error(code: number, message: string): void {
    Logger.getInstance().log(LogLevel.ERROR, 'ERROR', chalk.red, code, message);
  }

  static criticalError(code: number, message: string): void {
    Logger.getInstance().log(LogLevel.CRITICAL, 'CERR', chalk.blue, code, message);
  }

  // New enhanced logging methods
  static operation(message: string): void {
    const formattedMessage = `🔄 ${message}`;
    console.log(Logger.getInstance().options.colorOutput ? chalk.cyan(formattedMessage) : formattedMessage);
    Logger.getInstance().writeToFile(`OPERATION: ${message}`);
  }

  static security(code: number, message: string): void {
    const formattedMessage = `🔒 SECURITY: ~code:${code} > ${message}`;
    console.log(Logger.getInstance().options.colorOutput ? chalk.magenta(formattedMessage) : formattedMessage);
    Logger.getInstance().writeToFile(formattedMessage);
  }

  static performance(message: string, duration?: number): void {
    const durationText = duration ? ` (${duration}ms)` : '';
    const formattedMessage = `⚡ PERF: ${message}${durationText}`;
    console.log(Logger.getInstance().options.colorOutput ? chalk.yellow(formattedMessage) : formattedMessage);
    Logger.getInstance().writeToFile(formattedMessage);
  }

  static close(): void {
    if (Logger.instance?.logFile) {
      Logger.instance.logFile.end();
    }
  }
}

// Setup graceful shutdown
process.on('exit', () => Logger.close());
process.on('SIGINT', () => {
  Logger.close();
  process.exit(130);
});
