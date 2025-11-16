// 监视并复制资源文件（HTML, CSS 等）
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'renderer');
const distDir = path.join(__dirname, '..', 'dist', 'renderer');

// 确保目标目录存在
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// 复制文件的函数
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
}

// 复制目录的函数
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
            // 跳过 .ts 文件
            copyFile(srcPath, destPath);
        }
    }
}

// 初始复制
console.log('Copying assets...');
copyDir(srcDir, distDir);
console.log('Initial copy completed.');

// 监视文件变化
console.log('Watching for changes...');
fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename || filename.endsWith('.ts')) {
        return; // 忽略 .ts 文件
    }

    const srcPath = path.join(srcDir, filename);
    const destPath = path.join(distDir, filename);

    if (fs.existsSync(srcPath)) {
        const stat = fs.statSync(srcPath);
        if (stat.isFile()) {
            copyFile(srcPath, destPath);
        }
    } else {
        // 文件被删除
        if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
            console.log(`Deleted: ${path.relative(process.cwd(), destPath)}`);
        }
    }
});
