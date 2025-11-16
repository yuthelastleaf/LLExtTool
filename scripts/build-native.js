const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const cmakeBuildDir = path.join(buildDir, 'cmake');

console.log('🔨 Building Native Modules with CMake...\n');

// 确保构建目录存在
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

if (!fs.existsSync(cmakeBuildDir)) {
  fs.mkdirSync(cmakeBuildDir, { recursive: true });
}

try {
  // 检查 CMake 是否安装
  console.log('Step 1: Checking CMake installation...');
  try {
    const cmakeVersion = execSync('cmake --version', { encoding: 'utf-8' });
    console.log(`✓ CMake found:\n${cmakeVersion.split('\n')[0]}\n`);
  } catch (error) {
    console.error('❌ CMake not found. Please install CMake first:');
    console.error('   Download from: https://cmake.org/download/');
    process.exit(1);
  }

  // 使用 cmake-js 构建
  console.log('Step 2: Building with cmake-js...');
  execSync('npx cmake-js compile --runtime electron --runtime-version 27.3.11 --arch x64', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('✓ Build completed\n');

  // If a node-gyp binding.gyp exists in native/, optionally build with node-gyp
  const nativeBinding = path.join(rootDir, 'native', 'binding.gyp');
  if (fs.existsSync(nativeBinding)) {
    try {
      console.log('Step 3: Found native/binding.gyp - building with node-gyp for node-addon style...');
      execSync('node-gyp rebuild', { cwd: path.join(rootDir, 'native'), stdio: 'inherit' });
      console.log('✓ node-gyp build completed\n');
    } catch (e) {
      console.warn('⚠ node-gyp build failed (continuing):', e.message);
    }
  }

  // 检查输出文件
  console.log('Step 5: Verifying output files...');
  const releaseDir = path.join(buildDir, 'Release');
  const llvideoNode = path.join(releaseDir, 'llvideo.node');
  const llwhisperNode = path.join(releaseDir, 'llwhisper.node');

  if (fs.existsSync(llvideoNode)) {
    console.log(`✓ llvideo.node: ${llvideoNode}`);
  } else {
    console.log(`⚠ llvideo.node not found (FFmpeg may not be configured)`);
  }

  if (fs.existsSync(llwhisperNode)) {
    console.log(`✓ llwhisper.node: ${llwhisperNode}`);
  } else {
    console.log(`⚠ llwhisper.node not found (Whisper may not be configured)`);
  }

  console.log('\n🎉 Native modules build completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Download FFmpeg shared libraries to native/ffmpeg/');
  console.log('2. Build whisper.cpp and place it in native/whisper.cpp/');
  console.log('3. Run this script again to build the modules');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
