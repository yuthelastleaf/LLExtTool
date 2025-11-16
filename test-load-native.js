// 测试加载 native 模块
const path = require('path');

const nativeDir = path.join(__dirname, 'build', 'Release');

console.log('DLL directory:', nativeDir);

// 设置 DLL 路径
if (process.platform === 'win32') {
  process.env.PATH = `${nativeDir};${process.env.PATH}`;
  console.log('PATH updated');
  
  if (typeof process.addDllDirectory === 'function') {
    try {
      process.addDllDirectory(nativeDir);
      console.log('DLL directory added');
    } catch (e) {
      console.error('Failed to add DLL directory:', e.message);
    }
  }
}

try {
  console.log('Loading llvideo...');
  const llvideoPath = path.join(nativeDir, 'llvideo.node');
  const llvideo = require(llvideoPath);
  console.log('✓ llvideo loaded successfully');
  console.log('llvideo exports:', Object.keys(llvideo));
} catch (error) {
  console.error('✗ Failed to load llvideo:', error.message);
  console.error('Stack:', error.stack);
}

try {
  console.log('\nLoading llwhisper...');
  const llwhisperPath = path.join(nativeDir, 'llwhisper.node');
  const llwhisper = require(llwhisperPath);
  console.log('✓ llwhisper loaded successfully');
  console.log('llwhisper exports:', Object.keys(llwhisper));
} catch (error) {
  console.error('✗ Failed to load llwhisper:', error.message);
  console.error('Stack:', error.stack);
}
