#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SUNZIP_VERSION = '1.0.0';
const RELEASE_DATE = '2025-07-19';

const szipPath = path.join(__dirname, 'szip.js');
const args = ['unzip', ...process.argv.slice(2)];

const isWindows = process.platform === 'win32';
const nodeCommand = isWindows ? 'node.exe' : 'node';

const spawnOptions = {
  stdio: 'inherit',
  shell: isWindows,
  env: { 
    ...process.env, 
    SZIP_REDIRECT: 'sunzip',
    SZIP_COLORS: process.stdout.isTTY ? '1' : '0',
    SZIP_VERSION: SUNZIP_VERSION
  },
  cwd: process.cwd()
};

function performPreflightChecks() {
  const issues = [];
  
  if (!fs.existsSync(szipPath)) {
    issues.push('Missing main szip.js executable');
  }
  
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    issues.push('Missing compiled TypeScript files in dist/');
  }
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 16) {
    issues.push(`Node.js version ${nodeVersion} is not supported. Minimum required: v16.0.0`);
  }
  
  return issues;
}

const preflightIssues = performPreflightChecks();
if (preflightIssues.length > 0) {
  console.error('❌ CERR: ~code:503 > Installation issues detected:');
  preflightIssues.forEach(issue => {
    console.error(`   • ${issue}`);
  });
  console.error('💡 Hint: Run "npm run build" to compile TypeScript files');
  process.exit(503);
}

const debugLog = (message) => {
  if (process.env.SZIP_DEBUG) {
    console.error(`[${new Date().toISOString()}] SUNZIP v${SUNZIP_VERSION}: ${message}`);
  }
};

const logError = (error, context = '') => {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    version: SUNZIP_VERSION,
    platform: process.platform,
    nodeVersion: process.version,
    context,
    error: error.message,
    code: error.code || 'UNKNOWN'
  };
  
  if (process.env.SZIP_DEBUG) {
    console.error('Error details:', JSON.stringify(errorDetails, null, 2));
  }
};

debugLog(`Initializing redirect to szip with args: ${args.join(' ')}`);

const child = spawn(nodeCommand, [szipPath, ...args], spawnOptions);

let hasExited = false;
let startTime = Date.now();

child.on('exit', (code, signal) => {
  if (hasExited) return;
  hasExited = true;
  
  const duration = Date.now() - startTime;
  debugLog(`Child process exited with code ${code} and signal ${signal} after ${duration}ms`);
  
  if (signal) {
    const exitCode = 128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 1);
    debugLog(`Exiting with signal-based code: ${exitCode}`);
    process.exit(exitCode);
  } else if (code === null) {
    console.error('❌ ERROR: ~code:502 > Child process terminated unexpectedly');
    process.exit(502);
  } else {
    process.exit(code || 0);
  }
});

child.on('error', (error) => {
  if (hasExited) return;
  hasExited = true;
  
  logError(error, 'child_process_spawn');
  console.error('❌ CERR: ~code:501 > Failed to start subprocess:', error.message);
  
  switch (error.code) {
    case 'ENOENT':
      console.error('💡 Hint: Node.js executable not found. Please ensure Node.js is installed and in PATH.');
      console.error('   Visit: https://nodejs.org/ to download and install Node.js');
      break;
    case 'EACCES':
      console.error('💡 Hint: Permission denied. Try running with appropriate permissions:');
      console.error(isWindows ? '   Run as Administrator' : '   Use sudo or check file permissions');
      break;
    case 'EMFILE':
    case 'ENFILE':
      console.error('💡 Hint: Too many open files. Close other applications and try again.');
      break;
    case 'ENOMEM':
      console.error('💡 Hint: Not enough memory. Close other applications or restart your system.');
      break;
    default:
      console.error('💡 Hint: Ensure Node.js is properly installed and the package is not corrupted.');
      console.error('   Try reinstalling: npm uninstall -g simpl-zip && npm install -g simpl-zip');
  }
  
  process.exit(501);
});

const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
if (!isWindows) {
  signals.push('SIGUSR1', 'SIGUSR2');
}

signals.forEach(signal => {
  process.on(signal, () => {
    debugLog(`Received ${signal}, performing graceful shutdown`);
    
    if (child && !child.killed && !hasExited) {
      debugLog('Sending termination signal to child process');
      child.kill(signal);
      
      setTimeout(() => {
        if (!child.killed && !hasExited) {
          debugLog('Force killing child process after timeout');
          child.kill('SIGKILL');
        }
      }, 3000);
      
      setTimeout(() => {
        if (!hasExited) {
          console.error('❌ WARN: ~code:504 > Force exit after cleanup timeout');
          process.exit(504);
        }
      }, 5000);
    }
    
    if (!hasExited) {
      const exitCode = signal === 'SIGINT' ? 130 : 128 + (signal === 'SIGTERM' ? 15 : 1);
      setTimeout(() => {
        if (!hasExited) {
          hasExited = true;
          process.exit(exitCode);
        }
      }, 100);
    }
  });
});

process.on('uncaughtException', (error) => {
  if (hasExited) return;
  hasExited = true;
  
  const sanitizedMessage = error.message.replace(/\/[^\s]*node_modules[^\s]*/g, '[NODE_MODULES_PATH]');
  console.error('❌ CERR: ~code:500 > Critical error - Uncaught Exception:', sanitizedMessage);
  logError(error, 'uncaught_exception');
  
  try {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  } catch (killError) {
    debugLog(`Error during child termination: ${killError.message}`);
  }
  
  const forceExitTimer = setTimeout(() => {
    process.exit(500);
  }, 2000);
  
  process.once('exit', () => clearTimeout(forceExitTimer));
});

process.on('unhandledRejection', (reason, promise) => {
  if (hasExited) return;
  hasExited = true;
  
  console.error('❌ CERR: ~code:500 > Critical error - Unhandled Promise Rejection');
  
  let sanitizedReason;
  try {
    sanitizedReason = reason instanceof Error ? reason.message : String(reason);
    sanitizedReason = sanitizedReason.replace(/\/[^\s]*node_modules[^\s]*/g, '[NODE_MODULES_PATH]');
    sanitizedReason = sanitizedReason.replace(/file:\/\/\/[^\s]*/g, '[FILE_PATH]');
  } catch (stringifyError) {
    sanitizedReason = 'Unable to process rejection reason safely';
  }
  
  console.error('Reason:', sanitizedReason);
  
  const error = reason instanceof Error ? reason : new Error(sanitizedReason);
  logError(error, 'unhandled_rejection');
  
  try {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  } catch (killError) {
    debugLog(`Error during child termination: ${killError.message}`);
  }
  
  const forceExitTimer = setTimeout(() => {
    process.exit(500);
  }, 2000);
  
  process.once('exit', () => clearTimeout(forceExitTimer));
});

if (process.env.SZIP_MONITOR === 'true') {
  let monitorInterval;
  
  try {
    monitorInterval = setInterval(() => {
      if (!hasExited && child && !child.killed) {
        debugLog('Health check: Child process is running');
        
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > 500 * 1024 * 1024) { 
          console.error('❌ WARN: ~code:507 > High memory usage detected:', Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB');
        }
      }
    }, 30000);
    
    const cleanup = () => {
      try {
        if (monitorInterval) {
          clearInterval(monitorInterval);
          monitorInterval = null;
        }
      } catch (cleanupError) {
        debugLog(`Error during monitor cleanup: ${cleanupError.message}`);
      }
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (monitorError) {
    debugLog(`Failed to initialize monitoring: ${monitorError.message}`);
  }
}

try {
  if (process.platform !== 'win32') {
    const maxFds = 1024;
    process.setrlimit('nofile', { soft: maxFds, hard: maxFds });
  }
} catch (rlimitError) {
  debugLog(`Could not set resource limits: ${rlimitError.message}`);
}

if (process.platform === 'linux') {
  try {
    fs.writeFileSync('/proc/self/oom_score_adj', '100');
  } catch (oomError) {
    debugLog(`Could not adjust OOM score: ${oomError.message}`);
  }
}

if (!fs.existsSync(szipPath)) {
  try {
    const fallbackSzip = `#!/usr/bin/env node
console.error('❌ ERROR: ~code:503 > Core szip executable missing');
console.error('💡 Hint: Please reinstall simpl-zip package');
process.exit(503);`;
    fs.writeFileSync(szipPath, fallbackSzip, { mode: 0o755 });
    debugLog('Created fallback szip.js');
  } catch (createError) {
    debugLog(`Could not create fallback szip.js: ${createError.message}`);
  }
}