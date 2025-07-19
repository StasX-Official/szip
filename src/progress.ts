const chalk = require('chalk');

export interface ProgressOptions {
  width?: number;
  style?: 'bar' | 'dots' | 'spinner';
  showPercentage?: boolean;
  showETA?: boolean;
  showSpeed?: boolean;
  theme?: 'default' | 'minimal' | 'fancy';
}

export class ProgressBar {
  private current: number = 0;
  private total: number;
  private width: number;
  private description: string;
  private startTime: number;
  private lastUpdateTime: number;
  private options: Required<ProgressOptions>;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;
  private isCompleted = false;

  constructor(total: number, description: string = '', options: ProgressOptions = {}) {
    this.total = total;
    this.description = description;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.options = {
      width: 40,
      style: 'bar',
      showPercentage: true,
      showETA: true,
      showSpeed: false,
      theme: 'default',
      ...options
    };
    this.width = this.options.width;
  }

  update(current: number): void {
    if (this.isCompleted) return;
    
    this.current = Math.min(current, this.total);
    this.lastUpdateTime = Date.now();
    this.render();
    
    if (this.current >= this.total) {
      this.complete();
    }
  }

  increment(value: number = 1): void {
    this.update(this.current + value);
  }

  private render(): void {
    const percentage = Math.min(100, (this.current / this.total) * 100);
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.current / elapsed;
    const eta = this.current > 0 ? (this.total - this.current) / rate : 0;
    
    let progressBar = '';
    
    switch (this.options.style) {
      case 'bar':
        progressBar = this.renderBar(percentage);
        break;
      case 'dots':
        progressBar = this.renderDots(percentage);
        break;
      case 'spinner':
        progressBar = this.renderSpinner();
        break;
    }
    
    let output = '';
    
    if (this.description) {
      output += `${this.description} `;
    }
    
    output += progressBar;
    
    if (this.options.showPercentage) {
      output += ` ${percentage.toFixed(1)}%`;
    }
    
    if (this.options.showETA && eta > 0 && eta < Infinity) {
      output += ` ETA: ${this.formatTime(eta)}`;
    }
    
    if (this.options.showSpeed && rate > 0) {
      output += ` (${this.formatSpeed(rate)})`;
    }
    
    // Add file count if available
    if (this.current > 0) {
      output += ` ${this.current}/${this.total}`;
    }
    
    process.stdout.write(`\r${output}`);
  }

  private renderBar(percentage: number): string {
    const filledWidth = Math.round((this.width * percentage) / 100);
    const emptyWidth = this.width - filledWidth;
    
    switch (this.options.theme) {
      case 'fancy':
        return `${chalk.green('█'.repeat(filledWidth))}${chalk.gray('░'.repeat(emptyWidth))}`;
      case 'minimal':
        return `${'='.repeat(filledWidth)}${'-'.repeat(emptyWidth)}`;
      default:
        return `[${chalk.green('█'.repeat(filledWidth))}${chalk.gray('░'.repeat(emptyWidth))}]`;
    }
  }

  private renderDots(percentage: number): string {
    const filledDots = Math.round((this.width * percentage) / 100);
    const emptyDots = this.width - filledDots;
    
    return `${chalk.green('●'.repeat(filledDots))}${chalk.gray('○'.repeat(emptyDots))}`;
  }

  private renderSpinner(): string {
    const frame = this.spinnerFrames[this.spinnerIndex];
    this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    return chalk.blue(frame);
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  private formatSpeed(itemsPerSecond: number): string {
    if (itemsPerSecond < 1) {
      return `${(itemsPerSecond * 60).toFixed(1)}/min`;
    }
    return `${itemsPerSecond.toFixed(1)}/s`;
  }

  complete(): void {
    if (this.isCompleted) return;
    
    this.isCompleted = true;
    this.current = this.total;
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.total / elapsed;
    
    let output = '';
    
    if (this.description) {
      output += `${this.description} `;
    }
    
    // Show completed bar
    switch (this.options.theme) {
      case 'fancy':
        output += `${chalk.green('█'.repeat(this.width))} ✨`;
        break;
      case 'minimal':
        output += `${'='.repeat(this.width)} ✓`;
        break;
      default:
        output += `[${chalk.green('█'.repeat(this.width))}] ✅`;
    }
    
    output += ` 100.0% `;
    output += `завершено за ${this.formatTime(elapsed)}`;
    
    if (this.options.showSpeed) {
      output += ` (${this.formatSpeed(rate)})`;
    }
    
    process.stdout.write(`\r${output}\n`);
  }

  clear(): void {
    process.stdout.write('\r' + ' '.repeat(120) + '\r');
  }

  static createMultiBar(items: Array<{total: number, description: string}>): ProgressBar[] {
    return items.map(item => new ProgressBar(item.total, item.description));
  }
}
