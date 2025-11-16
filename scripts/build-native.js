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

  // 步骤 2: 先复制 FFmpeg 头文件到 whisper.cpp/include（解决 electron-rebuild 找不到的问题）
  console.log('Step 2: Copying FFmpeg headers...');
  const ffmpegIncludeSrc = path.join(rootDir, 'native', 'ffmpeg', 'include');
  const whisperIncludeDst = path.join(rootDir, 'native', 'whisper.cpp', 'include');
  
  if (fs.existsSync(ffmpegIncludeSrc) && fs.existsSync(whisperIncludeDst)) {
    try {
      // 递归复制 FFmpeg 头文件（libavcodec, libavformat, etc.）
      const copyRecursive = (src, dst) => {
        if (!fs.existsSync(dst)) {
          fs.mkdirSync(dst, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const dstPath = path.join(dst, entry.name);
          if (entry.isDirectory()) {
            copyRecursive(srcPath, dstPath);
          } else {
            fs.copyFileSync(srcPath, dstPath);
          }
        }
      };
      copyRecursive(ffmpegIncludeSrc, whisperIncludeDst);
      console.log(`✓ FFmpeg headers copied to ${whisperIncludeDst}\n`);
    } catch (e) {
      console.warn('⚠ Failed to copy FFmpeg headers:', e.message);
    }
  }

  // 步骤 3: 使用 electron-rebuild 编译（现在应该能找到所有头文件）
  console.log('Step 3: Building with electron-rebuild...');
  const electronRebuildSuccess = [];
  const electronRebuildFailed = [];
  
  try {
    execSync('npx electron-rebuild -f -v 27.3.11', {
      cwd: rootDir,
      stdio: 'inherit'
    });
    console.log('✓ electron-rebuild completed\n');
    
    // 检查哪些模块成功编译
    const releaseDir = path.join(buildDir, 'Release');
    if (fs.existsSync(path.join(releaseDir, 'llvideo.node'))) {
      electronRebuildSuccess.push('llvideo');
    }
    if (fs.existsSync(path.join(releaseDir, 'llwhisper.node'))) {
      electronRebuildSuccess.push('llwhisper');
    }
  } catch (e) {
    console.warn('⚠ electron-rebuild encountered errors\n');
  }

  // 步骤 4: 备份 electron-rebuild 的成功输出（防止被覆盖）
  console.log('Step 4: Backing up electron-rebuild output...');
  const releaseDir = path.join(buildDir, 'Release');
  const backupDir = path.join(buildDir, 'electron-rebuild-backup');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  if (fs.existsSync(releaseDir)) {
    const nodeFiles = fs.readdirSync(releaseDir).filter(f => f.endsWith('.node'));
    nodeFiles.forEach(file => {
      const srcPath = path.join(releaseDir, file);
      const backupPath = path.join(backupDir, file);
      fs.copyFileSync(srcPath, backupPath);
      console.log(`  Backed up: ${file}`);
    });
  }
  console.log('');

  // 步骤 5: 恢复 electron-rebuild 的输出（确保不被覆盖）
  console.log('Step 5: Restoring electron-rebuild modules...');
  if (fs.existsSync(backupDir)) {
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.node'));
    backupFiles.forEach(file => {
      const backupPath = path.join(backupDir, file);
      const targetPath = path.join(releaseDir, file);
      fs.copyFileSync(backupPath, targetPath);
      console.log(`  Restored: ${file}`);
    });
  }
  console.log('');

  // 检查输出文件
  console.log('Step 6: Verifying output files...');
  const llvideoNode = path.join(releaseDir, 'llvideo.node');
  const llwhisperNode = path.join(releaseDir, 'llwhisper.node');

  if (fs.existsSync(llvideoNode)) {
    console.log(`✓ llvideo.node: ${llvideoNode}`);
  } else {
    console.log(`⚠ llvideo.node not found`);
  }

  if (fs.existsSync(llwhisperNode)) {
    console.log(`✓ llwhisper.node: ${llwhisperNode}`);
  } else {
    console.log(`⚠ llwhisper.node not found`);
  }

  console.log('\n🎉 Native modules build completed with electron-rebuild!');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
