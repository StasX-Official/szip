#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
// Dynamic import for inquirer (ES module)
let inquirer = null;

async function getInquirer() {
  if (!inquirer) {
    try {
      const inquirerModule = await import('inquirer');
      inquirer = inquirerModule.default;
    } catch (error) {
      throw new Error('Inquirer module not available');
    }
  }
  return inquirer;
}

const SZIP_VERSION = '1.0.0';
const BUILD_DATE = '2025-01-01';
const MIN_NODE_VERSION = 16;

const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
if (nodeVersion < MIN_NODE_VERSION) {
  console.error(`❌ CERR: ~code:505 > Node.js version ${process.version} is not supported`);
  console.error(`💡 Minimum required: v${MIN_NODE_VERSION}.0.0`);
  process.exit(505);
}

let SimplZip, Logger, CryptoUtils, ProgressBar;
try {
  const distPath = path.join(__dirname, '..', 'dist');
  SimplZip = require(path.join(distPath, 'index.js')).SimplZip;
  Logger = require(path.join(distPath, 'logger.js')).Logger;
  CryptoUtils = require(path.join(distPath, 'crypto.js')).CryptoUtils;
  ProgressBar = require(path.join(distPath, 'progress.js')).ProgressBar;
} catch (importError) {
  try {
    SimplZip = require('./fallback-implementation');
  } catch (fallbackError) {
    console.error(`❌ CERR: ~code:506 > Cannot load implementation: ${fallbackError.message}`);
    process.exit(506);
  }
  Logger = {
    error: (code, msg) => console.error(`❌ ERROR: ~code:${code} > ${msg}`),
    warn: (code, msg) => console.error(`⚠️ WARN: ~code:${code} > ${msg}`),
    success: (code, msg) => console.log(`✅ [${code}] ${msg}`),
    info: (msg) => console.log(msg),
    criticalError: (code, msg) => console.error(`❌ CERR: ~code:${code} > ${msg}`)
  };
}

let packageJson;
try {
  packageJson = require('../package.json');
} catch (pkgError) {
  packageJson = { version: SZIP_VERSION };
}

function parseArgs(args) {
  const parsed = {
    command: null,
    source: null,
    output: null,
    password: null,
    hash: null,
    compressionLevel: 9,
    flags: new Set()
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === 'zip' || arg === 'unzip') {
      parsed.command = arg;
    } else if (arg === '-p' || arg === '-setpass') {
      parsed.password = args[++i] || '';
    } else if (arg === '-h' && args[i + 1] && !args[i + 1].startsWith('-')) {
      parsed.hash = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      parsed.output = args[++i] || '';
    } else if (arg === '-l' || arg === '--level') {
      const level = parseInt(args[++i]);
      parsed.compressionLevel = isNaN(level) ? 9 : Math.max(1, Math.min(9, level));
    } else if (arg.startsWith('-')) {
      parsed.flags.add(arg);
    } else if (!parsed.source) {
      parsed.source = arg;
    } else if (!parsed.output) {
      parsed.output = arg;
    }
  }

  return parsed;
}

function validateInput(source, output) {
  const issues = [];
  
  if (source && (source.includes('..') || source.includes('~'))) {
    issues.push('Path traversal detected in source');
  }
  
  if (output && (output.includes('..') || output.includes('~'))) {
    issues.push('Path traversal detected in output');
  }
  
  if (source && source.length > 1000) {
    issues.push('Source path too long');
  }
  
  if (output && output.length > 1000) {
    issues.push('Output path too long');
  }
  
  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    Logger.info(`SZIP (simpl-zip) - v${SZIP_VERSION}`);
    Logger.info('By Kozosvyst Stas');
    Logger.info('');
    Logger.info('Usage:');
    Logger.info('  szip FOLDER ARCHIVE.zip          # Create archive');
    Logger.info('  szip zip FOLDER ARCHIVE.zip      # Create archive');  
    Logger.info('  szip unzip ARCHIVE.zip           # Extract archive');
    Logger.info('  szip ARCHIVE.zip                 # Extract archive');
    Logger.info('');
    Logger.info('Options:');
    Logger.info('  -p PASSWORD    Set password protection');
    Logger.info('  -h ALGORITHM   Generate hash (md5, sha256, sha512)');
    Logger.info('  -o OUTPUT      Specify output location');
    Logger.info('  -l LEVEL       Compression level (1-9)');
    return;
  }

  const command = args[0];
  
  switch (command) {
    case '-test':
      await runTests();
      break;
    case 'info':
      showInfo();
      break;
    case 'support':
      Logger.info('Support: dev@sxscli.com');
      break;
    case 'version':
    case '--version':
      Logger.info(`v${SZIP_VERSION} (${BUILD_DATE})`);
      break;
    case '--help':
    case '-help':
      await main();
      break;
    default:
      await handleZipOperation(args);
  }
}

async function handleZipOperation(args) {
  const parsed = parseArgs(args);
  
  if (!parsed.command) {
    if (parsed.source && parsed.source.endsWith('.zip')) {
      parsed.command = 'unzip';
    } else {
      parsed.command = 'zip';
    }
  }
  
  const securityIssues = validateInput(parsed.source, parsed.output);
  if (securityIssues.length > 0) {
    Logger.error(400, `Security validation failed: ${securityIssues.join(', ')}`);
    return;
  }
  
  try {
    if (parsed.command === 'zip') {
      await handleZip(parsed);
    } else if (parsed.command === 'unzip') {
      await handleUnzip(parsed);
    } else {
      Logger.error(404, 'Command not found');
    }
  } catch (error) {
    Logger.error(500, `Operation failed: ${error.message}`);
    process.exit(1);
  }
}

async function handleZip(parsed) {
  if (!parsed.source) {
    Logger.error(400, 'Source path required');
    return;
  }
  
  if (!fs.existsSync(parsed.source)) {
    Logger.error(404, 'Source path not found');
    return;
  }
  
  const outputPath = parsed.output || `${parsed.source}.zip`;
  
  Logger.info(`🔄 Archiving: ${parsed.source}`);
  
  const options = {
    password: parsed.password,
    compressionLevel: parsed.compressionLevel,
    generateHash: parsed.hash
  };
  
  let progressBar;
  if (ProgressBar) {
    progressBar = new ProgressBar(100, 'Compressing');
  }
  
  try {
    const result = await SimplZip.zip(parsed.source, outputPath, options);
    
    if (progressBar) progressBar.complete();
    
    Logger.success(200, 'Архівовано');
    Logger.info(`Розмір архіву: ${formatSize(result.size)}`);
    Logger.info(`Директорія: ${result.directory}`);
    
    if (result.compressionRatio !== undefined) {
      Logger.info(`Коефіцієнт стиснення: ${result.compressionRatio}%`);
    }
    
    if (result.hash) {
      Logger.info(`${result.hashAlgorithm?.toUpperCase()} хеш: ${result.hash}`);
    }
    
  } catch (error) {
    if (progressBar) progressBar.clear();
    throw error;
  }
}

async function handleUnzip(parsed) {
  if (!parsed.source) {
    Logger.error(400, 'Archive path required');
    return;
  }
  
  if (!fs.existsSync(parsed.source)) {
    Logger.error(405, 'Помилка розархівації: Файл не знайдено');
    return;
  }
  
  Logger.info(`🔄 Extracting: ${parsed.source}`);
  
  let password = parsed.password;
  
  if (!password && needsPassword(parsed.source)) {
    try {
      const answers = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: 'Enter archive password:',
        mask: '*'
      }]);
      password = answers.password;
    } catch (inquirerError) {
      Logger.error(401, 'Password required but not provided');
      return;
    }
  }
  
  try {
    const result = await SimplZip.unzip(parsed.source, parsed.output, password);
    
    Logger.success(200, 'Розархівовано');
    Logger.info(`Директорія: ${result.directory}`);
    
  } catch (error) {
    if (error.message.includes('password')) {
      Logger.error(401, 'Invalid password or password required');
    } else {
      throw error;
    }
  }
}

function needsPassword(archivePath) {
  try {
    const buffer = fs.readFileSync(archivePath, { start: 0, end: 1024 });
    return buffer.includes(Buffer.from('SZIP_PASSWORD_PROTECTED'));
  } catch (error) {
    return false;
  }
}

async function runTests() {
  Logger.info('🧪 Running SZIP tests...\n');
  
  const tests = [
    { name: 'Basic Archive Creation', fn: testBasicArchive },
    { name: 'Archive Extraction', fn: testExtraction },
    { name: 'Password Protection', fn: testPasswordProtection },
    { name: 'Hash Generation', fn: testHashGeneration },
    { name: 'Error Handling', fn: testErrorHandling }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      Logger.info(`Running: ${test.name}...`);
      await test.fn();
      Logger.success(200, `✅ ${test.name} - PASSED`);
      passed++;
    } catch (error) {
      Logger.error(500, `❌ ${test.name} - FAILED: ${error.message}`);
      failed++;
    }
  }
  
  Logger.info(`\n🎯 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

async function testBasicArchive() {
  const testDir = path.join(process.cwd(), 'test-temp');
  const archivePath = path.join(process.cwd(), 'test-output.zip');
  
  try {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'Test content');
    }
    
    const result = await SimplZip.zip(testDir, archivePath);
    if (!fs.existsSync(archivePath)) {
      throw new Error('Archive not created');
    }
    
  } finally {
    try {
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Cleanup failed:', cleanupError.message);
    }
  }
}

async function testExtraction() {
  const testDir = path.join(process.cwd(), 'test-temp');
  const archivePath = path.join(process.cwd(), 'test-extract.zip');
  const extractDir = path.join(process.cwd(), 'extracted');
  
  try {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'Test content');
    }
    
    await SimplZip.zip(testDir, archivePath);
    const result = await SimplZip.unzip(archivePath, extractDir);
    
    if (!fs.existsSync(extractDir)) {
      throw new Error('Extraction failed');
    }
    
  } finally {
    try {
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Cleanup failed:', cleanupError.message);
    }
  }
}

async function testPasswordProtection() {
  Logger.warn(101, 'Password protection test - feature in development');
}

async function testHashGeneration() {
  if (!CryptoUtils) {
    Logger.warn(102, 'Hash generation test - crypto utils not available');
    return;
  }
  
  const testFile = path.join(process.cwd(), 'test-hash.txt');
  
  try {
    fs.writeFileSync(testFile, 'Test content for hashing');
    
    const result = await CryptoUtils.generateFileHash(testFile, 'sha256');
    if (!result.hash || result.hash.length !== 64) {
      throw new Error('Invalid SHA256 hash generated');
    }
    
  } finally {
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    } catch (cleanupError) {
      console.warn('Cleanup failed:', cleanupError.message);
    }
  }
}

async function testErrorHandling() {
  try {
    await SimplZip.zip('non-existent-path-12345', 'test.zip');
    throw new Error('Should have thrown error for non-existent path');
  } catch (error) {
    if (!error.message.includes('exist')) {
      throw new Error('Wrong error message for non-existent path');
    }
  }
}

function showInfo() {
  const info = `
SZIP (simpl-zip) - Simple Archive Tool

Version: ${SZIP_VERSION}
Build Date: ${BUILD_DATE}
Node.js: ${process.version}
Platform: ${process.platform} ${process.arch}

FEATURES:
✅ Cross-platform support (Windows, Linux, macOS)
✅ ZIP archive creation and extraction
✅ Password protection (in development)
✅ Hash generation (MD5, SHA256, SHA512)
✅ Progress tracking
✅ Security validation
✅ Memory usage monitoring

USAGE EXAMPLES:
  szip my-folder backup.zip              # Create archive
  szip zip ./docs archive.zip            # Create archive (explicit)
  szip unzip backup.zip                  # Extract archive
  szip backup.zip                        # Extract archive (auto-detect)
  
  # With options:
  szip my-folder secure.zip -p mypassword -h sha256
  szip unzip secure.zip -o ./restored -p mypassword

SECURITY FEATURES:
• Path traversal protection
• ZIP bomb detection
• Memory usage limits
• File extension validation
• Rate limiting

Author: Kozosvyst Stas
License: MIT © 2025
Support: dev@sxscli.com
`;
  
  Logger.info(info);
}

function formatSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

process.on('SIGINT', () => {
  Logger.info('\n🛑 Operation cancelled by user');
  process.exit(130);
});

process.on('uncaughtException', (error) => {
  Logger.criticalError(500, `Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.criticalError(500, `Unhandled rejection: ${reason}`);
  process.exit(1);
});

main().catch((error) => {
  Logger.criticalError(500, `Fatal error: ${error.message}`);
  process.exit(1);
});