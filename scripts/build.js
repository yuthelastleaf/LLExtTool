// 构建脚本 - 编译 TypeScript 并复制资源文件
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building LLExtTool...\n');

// 1. 编译 TypeScript
console.log('Step 1: Compiling TypeScript...');
try {
    execSync('npx tsc', { stdio: 'inherit' });
    console.log('✓ TypeScript compilation completed\n');
} catch (error) {
    console.error('✗ TypeScript compilation failed');
    process.exit(1);
}

// 2. 复制资源文件
console.log('Step 2: Copying assets...');
const srcDir = path.join(__dirname, '..', 'src', 'renderer');
const distDir = path.join(__dirname, '..', 'dist', 'renderer');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (!entry.name.endsWith('.ts')) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`  Copied: ${entry.name}`);
        }
    }
}

try {
    copyDir(srcDir, distDir);
    console.log('✓ Assets copied successfully\n');
} catch (error) {
    console.error('✗ Failed to copy assets:', error.message);
    process.exit(1);
}

console.log('Build completed successfully! 🎉');
