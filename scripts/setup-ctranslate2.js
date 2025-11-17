/**
 * 下载和配置 CTranslate2
 * 
 * CTranslate2 提供高性能的神经机器翻译推理
 * 支持 MarianMT, NLLB 等 Transformer 翻译模型
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nativeDir = path.join(__dirname, '..', 'native');
const ctranslate2Dir = path.join(nativeDir, 'ctranslate2');

console.log('设置 CTranslate2...\n');

// 创建目录
if (!fs.existsSync(ctranslate2Dir)) {
  fs.mkdirSync(ctranslate2Dir, { recursive: true });
}

console.log('CTranslate2 需要手动安装:');
console.log('');
console.log('方案 1: 使用预编译版本 (推荐)');
console.log('  1. 访问: https://github.com/OpenNMT/CTranslate2/releases');
console.log('  2. 下载 Windows x64 版本 (ctranslate2-*-windows-x64.zip)');
console.log('  3. 解压到: native/ctranslate2/');
console.log('');
console.log('方案 2: 使用 conda 安装');
console.log('  conda install -c conda-forge ctranslate2');
console.log('  然后复制文件到: native/ctranslate2/');
console.log('');
console.log('需要的文件结构:');
console.log('  native/ctranslate2/');
console.log('    ├── include/');
console.log('    │   └── ctranslate2/');
console.log('    ├── lib/');
console.log('    │   └── ctranslate2.lib');
console.log('    └── bin/');
console.log('        └── ctranslate2.dll');
console.log('');

// 检查是否已安装
const requiredFiles = [
  path.join(ctranslate2Dir, 'include', 'ctranslate2', 'translator.h'),
  path.join(ctranslate2Dir, 'lib', 'ctranslate2.lib'),
  path.join(ctranslate2Dir, 'bin', 'ctranslate2.dll')
];

const allExist = requiredFiles.every(file => fs.existsSync(file));

if (allExist) {
  console.log('✓ CTranslate2 已安装');
} else {
  console.log('✗ CTranslate2 未安装，请按照上述说明安装');
  process.exit(1);
}
