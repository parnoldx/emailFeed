#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const BUILD_DIR = 'dist';
const XPI_NAME = 'email-feed.xpi';

// Files and directories to include in the build
const INCLUDE_PATTERNS = [
  'manifest.json',
  'background.js',
  'emailfeed/**/*',
  'icons/**/*',
  '!**/.DS_Store',
  '!**/Thumbs.db'
];

async function build() {
  console.log('🔨 Building Email Feed extension...');
  
  try {
    // Clean build directory
    await fs.remove(BUILD_DIR);
    await fs.ensureDir(BUILD_DIR);
    
    // Copy files to build directory
    console.log('📁 Copying extension files...');
    
    for (const pattern of INCLUDE_PATTERNS) {
      if (pattern.startsWith('!')) continue;
      
      const srcPath = pattern.replace('/**/*', '');
      const isFile = !pattern.includes('*');
      
      if (await fs.pathExists(srcPath)) {
        const destPath = path.join(BUILD_DIR, srcPath);
        
        if (isFile) {
          await fs.copy(srcPath, destPath);
          console.log(`  ✅ ${srcPath}`);
        } else {
          await fs.copy(srcPath, destPath);
          console.log(`  ✅ ${srcPath}/ (directory)`);
        }
      } else {
        console.log(`  ⚠️  ${srcPath} (not found, skipping)`);
      }
    }
    
    // Create XPI archive
    console.log('📦 Creating XPI package...');
    await createXPI();
    
    console.log('✨ Build completed successfully!');
    console.log(`📄 Extension package: ${BUILD_DIR}/${XPI_NAME}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

async function createXPI() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(path.join(BUILD_DIR, XPI_NAME));
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`  ✅ Created ${XPI_NAME} (${archive.pointer()} bytes)`);
      resolve();
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Add all files from build directory except the XPI itself
    archive.glob('**/*', {
      cwd: BUILD_DIR,
      ignore: [XPI_NAME]
    });
    
    archive.finalize();
  });
}

// Validation function
async function validate() {
  console.log('🔍 Validating extension files...');
  
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'emailfeed/emailfeed.html',
    'emailfeed/emailfeed.js',
    'emailfeed/emailfeed.css',
    'emailfeed/darkreader.js',
    'emailfeed/tracker-blocker.js'
  ];
  
  let valid = true;
  
  for (const file of requiredFiles) {
    if (await fs.pathExists(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} (missing)`);
      valid = false;
    }
  }
  
  // Validate manifest.json
  try {
    const manifest = await fs.readJson('manifest.json');
    
    if (!manifest.manifest_version) {
      console.log('  ❌ manifest.json: missing manifest_version');
      valid = false;
    }
    
    if (!manifest.name) {
      console.log('  ❌ manifest.json: missing name');
      valid = false;
    }
    
    if (!manifest.version) {
      console.log('  ❌ manifest.json: missing version');
      valid = false;
    }
    
    if (valid) {
      console.log('  ✅ manifest.json is valid');
    }
    
  } catch (error) {
    console.log('  ❌ manifest.json: invalid JSON');
    valid = false;
  }
  
  return valid;
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'validate':
      const isValid = await validate();
      process.exit(isValid ? 0 : 1);
      break;
      
    case 'build':
    default:
      await build();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { build, validate };