# simpl-zip

[![npm version](https://badge.fury.io/js/simpl-zip.svg)](https://badge.fury.io/js/simpl-zip)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/simpl-zip.svg)](https://nodejs.org)

Simple ZIP archiving tool with password protection for easy command-line usage.

## 🚀 Features

- ✅ **Cross-platform** - Works on Windows, Linux, and macOS  
- ✅ **Easy to use** - Simple command-line interface
- ✅ **Password protection** - Secure your archives
- ✅ **Hash generation** - Verify archive integrity
- ✅ **Progress tracking** - See compression progress
- ✅ **Security focused** - Built-in protection against ZIP bombs and path traversal
- ✅ **TypeScript support** - Full type definitions included

## 📦 Installation

```bash
# Install globally for command-line usage
npm install -g simpl-zip

# Or install locally in your project
npm install simpl-zip
```

## 🎯 Quick Start

### Create Archives

```bash
# Archive a folder
szip my-folder my-archive.zip

# Archive with password protection
szip my-folder secure.zip -p mypassword

# Archive with hash generation
szip my-folder verified.zip -h sha256

# Archive with custom compression level
szip my-folder compressed.zip -l 9
```

### Extract Archives

```bash
# Extract archive
szip unzip my-archive.zip

# Extract to specific directory
szip unzip my-archive.zip -o ./extracted

# Extract password-protected archive
szip unzip secure.zip -p mypassword
```

### Alternative Syntax

```bash
# Direct extraction (auto-detect)
szip my-archive.zip

# Using sunzip command
sunzip my-archive.zip
```

## 📖 Usage

### Command Syntax

```bash
szip [command] <source> [output] [options]
```

### Commands

- `zip` - Create archive (default if source is not .zip)
- `unzip` - Extract archive (default if source is .zip)
- `info` - Show detailed information
- `support` - Show support contact
- `-test` - Run self-tests

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `-p PASSWORD` | Set password protection | `-p mypassword` |
| `-h ALGORITHM` | Generate hash (md5, sha256, sha512) | `-h sha256` |
| `-o OUTPUT` | Specify output location | `-o ./backup` |
| `-l LEVEL` | Compression level (1-9) | `-l 9` |

### Examples

```bash
# Basic usage
szip documents backup.zip
szip backup.zip

# Advanced usage
szip photos secure-photos.zip -p secret123 -h sha256 -l 9
szip unzip secure-photos.zip -p secret123 -o ./restored-photos

# Batch operations
szip project-src project-v1.0.zip -h sha256
szip project-v1.0.zip -o ./project-restored
```

## 🔒 Security Features

### Path Traversal Protection
Automatically prevents directory traversal attacks (`../../../etc/passwd`).

### ZIP Bomb Detection
Detects and prevents ZIP bomb attacks that could exhaust system resources.

### File Validation
Validates file names and extensions to prevent malicious files.

### Memory Monitoring
Monitors memory usage to prevent resource exhaustion.

## 🧪 Testing

Run the built-in test suite:

```bash
szip -test
```

Run development tests:

```bash
npm test
npm run test:coverage
```

## 🔧 Development

### Building from Source

```bash
git clone https://github.com/yourusername/simpl-zip.git
cd simpl-zip
npm install
npm run build
npm test
```

### Project Structure

```
simpl-zip/
├── bin/                 # Executable files
│   ├── szip.js         # Main CLI executable
│   └── sunzip.js       # Extraction shortcut
├── src/                 # TypeScript source files
│   ├── index.ts        # Core functionality
│   ├── logger.ts       # Logging utilities
│   ├── crypto.ts       # Cryptographic functions
│   ├── progress.ts     # Progress tracking
│   └── security.ts     # Security utilities
├── tests/              # Test files
├── dist/               # Compiled JavaScript
└── docs/               # Documentation
```

## 🐛 Troubleshooting

### Common Issues

**Error: "Missing main szip.js executable"**
```bash
npm run build  # Compile TypeScript files
```

**Error: "Node.js version not supported"**
```bash
# Upgrade Node.js to v16.0.0 or higher
```

**Error: "Permission denied"**
```bash
# On Linux/macOS:
sudo chmod +x /usr/local/bin/szip

# On Windows:
# Run as Administrator
```

### Debug Mode

Enable debug logging:

```bash
SZIP_DEBUG=true szip my-folder archive.zip
```

### Memory Monitoring

Enable memory monitoring:

```bash
SZIP_MONITOR=true szip large-folder archive.zip
```

## 📊 Performance

### Benchmarks

| Archive Size | Compression Time | Memory Usage |
|-------------|------------------|--------------|
| 10 MB       | ~2 seconds      | ~50 MB       |
| 100 MB      | ~15 seconds     | ~100 MB      |
| 1 GB        | ~2 minutes      | ~200 MB      |

### Optimization Tips

1. Use appropriate compression levels (-l 1 for speed, -l 9 for size)
2. Enable progress tracking for large archives
3. Monitor memory usage for very large files
4. Use hash generation only when needed

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Development Setup

```bash
git clone https://github.com/yourusername/simpl-zip.git
cd simpl-zip
npm install
npm run build
npm test
```

### Submitting Issues

Please include:
- Operating system and version
- Node.js version
- Full command that failed
- Error message (if any)
- Debug output (`SZIP_DEBUG=true`)

## 📄 License

MIT License © 2025 Kozosvyst Stas

## 🙏 Acknowledgments

- Built with [archiver](https://github.com/archiverjs/node-archiver) and [yauzl](https://github.com/thejoshwolfe/yauzl)
- Inspired by the need for simple, secure archiving tools
- Thanks to all contributors and users

## 📞 Support

- Email: dev@sxscli.com
- Issues: [GitHub Issues](https://github.com/yourusername/simpl-zip/issues)
- Documentation: [Wiki](https://github.com/yourusername/simpl-zip/wiki)

---

**Made with ❤️ by Kozosvyst Stas**