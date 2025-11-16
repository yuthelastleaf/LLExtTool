/**
 * 完整的端到端测试 - 视频处理流程
 * 1. 选择测试视频
 * 2. 提取音频
 * 3. 加载 Whisper 模型
 * 4. 转录音频
 * 5. 导出字幕
 */

const path = require('path');
const fs = require('fs');

// 加载 Native 模块
console.log('='.repeat(60));
console.log('LLExtTool 端到端测试');
console.log('='.repeat(60));

// 设置 DLL 路径
const dllDir = path.join(__dirname, 'build', 'Release');
process.env.PATH = `${dllDir};${process.env.PATH}`;
if (typeof process.addDllDirectory === 'function') {
  process.addDllDirectory(dllDir);
}

console.log('\n[1/6] 加载 Native 模块...');
const bindings = require('bindings');
const llvideo = bindings('llvideo');
const llwhisper = bindings('llwhisper');
console.log('✓ llvideo 模块加载成功');
console.log('✓ llwhisper 模块加载成功');

// 配置
const config = {
  // 请修改为你的测试视频路径
  videoPath: 'F:\\Downloads\\video.mp4',
  
  // 输出目录
  outputDir: path.join(__dirname, 'test-output'),
  
  // Whisper 模型路径
  modelPath: path.join(__dirname, 'native', 'whisper.cpp', 'models', 'ggml-large-v2-f16.bin'),
  
  // 转录参数
  language: 'ja',  // 日语
  params: {
    language: 'ja',
    translate: false,
    entropy_thold: 2.8,
    logprob_thold: -0.5,
    suppress_non_speech_tokens: true,
    n_threads: 8,  // 增加线程数以提高速度
    print_progress: true,
    print_timestamps: true,
    // GPU 相关 (需要编译时启用)
    use_gpu: true,  // 尝试使用 GPU
    // 性能优化
    speed_up: true,
    no_context: false,
    single_segment: false
  }
};

// 创建输出目录
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`✓ 创建输出目录: ${config.outputDir}`);
}

// 检查测试视频是否存在
console.log('\n[2/6] 检查测试视频...');
if (!fs.existsSync(config.videoPath)) {
  console.error(`✗ 测试视频不存在: ${config.videoPath}`);
  console.log('\n请修改 test-e2e.js 中的 videoPath 为你的测试视频路径');
  process.exit(1);
}

// 获取视频信息
console.log(`测试视频: ${config.videoPath}`);
try {
  const videoInfo = llvideo.getVideoInfo(config.videoPath);
  console.log(`✓ 视频信息:
  - 时长: ${videoInfo.duration.toFixed(2)} 秒 (${(videoInfo.duration / 60).toFixed(2)} 分钟)
  - 视频流: ${videoInfo.video_codec} ${videoInfo.width}x${videoInfo.height} @ ${videoInfo.fps} fps
  - 音频流: ${videoInfo.audio_codec} ${videoInfo.sample_rate}Hz ${videoInfo.channels}ch
  - 比特率: ${(videoInfo.bit_rate / 1000).toFixed(0)} kbps`);
} catch (error) {
  console.error('✗ 获取视频信息失败:', error.message);
  process.exit(1);
}

// 提取音频
console.log('\n[3/6] 提取音频...');
const audioPath = path.join(config.outputDir, 'audio.wav');
try {
  console.log('开始提取...');
  const startTime = Date.now();
  
  llvideo.extractAudio(config.videoPath, audioPath, 'wav');
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const audioSize = fs.statSync(audioPath).size;
  console.log(`✓ 音频提取完成
  - 输出文件: ${audioPath}
  - 文件大小: ${(audioSize / 1024 / 1024).toFixed(2)} MB
  - 耗时: ${duration} 秒`);
} catch (error) {
  console.error('✗ 音频提取失败:', error.message);
  process.exit(1);
}

// 检查模型文件
console.log('\n[4/6] 检查 Whisper 模型...');
if (!fs.existsSync(config.modelPath)) {
  console.error(`✗ 模型文件不存在: ${config.modelPath}`);
  console.log('\n请下载 Whisper 模型文件:');
  console.log('https://huggingface.co/ggerganov/whisper.cpp/tree/main');
  process.exit(1);
}
const modelSize = fs.statSync(config.modelPath).size;
console.log(`✓ 模型文件存在
  - 路径: ${config.modelPath}
  - 大小: ${(modelSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

// 加载模型
console.log('\n正在加载模型...');
try {
  const startTime = Date.now();
  llwhisper.loadModel(config.modelPath);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✓ 模型加载成功 (耗时: ${duration} 秒)`);
} catch (error) {
  console.error('✗ 模型加载失败:', error.message);
  process.exit(1);
}

// 转录音频
console.log('\n[5/6] 转录音频...');
console.log('参数配置:');
console.log(`  - 语言: ${config.params.language}`);
console.log(`  - 线程数: ${config.params.n_threads}`);
console.log(`  - Entropy 阈值: ${config.params.entropy_thold}`);
console.log(`  - Logprob 阈值: ${config.params.logprob_thold}`);
console.log(`  - 抑制非语音: ${config.params.suppress_non_speech_tokens}`);

try {
  console.log('\n开始转录...');
  console.log('提示: Whisper large-v2 模型较大,首次处理可能需要几分钟');
  console.log('     - 正在编码音频特征...');
  console.log('     - 正在解码语音...');
  console.log('     (Whisper.cpp 的进度输出在 stderr,可能不会显示在这里)\n');
  
  const startTime = Date.now();
  
  // 显示处理动画
  const progressInterval = setInterval(() => {
    process.stdout.write('.');
  }, 1000);
  
  const segments = llwhisper.transcribe(audioPath, config.params);
  
  clearInterval(progressInterval);
  console.log('');
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✓ 转录完成
  - 识别到 ${segments.length} 个片段
  - 耗时: ${duration} 秒 (${(duration / 60).toFixed(2)} 分钟)`);
  
  // 显示前几个片段
  console.log('\n前 3 个片段预览:');
  // Helper to format seconds into M:SS.ss, with fallback for invalid values
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
  }

  segments.slice(0, 3).forEach((seg, i) => {
    // Use the fields returned by the native addon (startTime/endTime)
    const start = formatTime(seg.startTime ?? seg.start);
    const end = formatTime(seg.endTime ?? seg.end);
    console.log(`  [${i + 1}] ${start} --> ${end}`);
    console.log(`      ${seg.text}`);
  });
  
  if (segments.length > 3) {
    console.log(`  ... 还有 ${segments.length - 3} 个片段`);
  }
  
  // 导出字幕
  console.log('\n[6/6] 导出字幕文件...');
  const exports = [
    { format: 'txt', func: llwhisper.exportToTxt },
    { format: 'srt', func: llwhisper.exportToSrt },
    { format: 'vtt', func: llwhisper.exportToVtt },
    { format: 'json', func: llwhisper.exportToJson },
    { format: 'lrc', func: llwhisper.exportToLrc }
  ];
  
  exports.forEach(({ format, func }) => {
    const outputPath = path.join(config.outputDir, `subtitle.${format}`);
    try {
      // The native export functions return the content as a string.
      const content = func(segments);
      // Write the returned content to the expected output file.
      fs.writeFileSync(outputPath, content, { encoding: 'utf8' });
      const size = fs.statSync(outputPath).size;
      console.log(`✓ ${format.toUpperCase()}: ${outputPath} (${(size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      console.error(`✗ ${format.toUpperCase()} 导出失败:`, error.message);
    }
  });
  
  // 测试完成
  console.log('\n' + '='.repeat(60));
  console.log('✅ 端到端测试完成!');
  console.log('='.repeat(60));
  console.log(`\n输出目录: ${config.outputDir}`);
  console.log('\n生成的文件:');
  console.log('  - audio.wav         (提取的音频)');
  console.log('  - subtitle.txt      (纯文本字幕)');
  console.log('  - subtitle.srt      (SRT 字幕)');
  console.log('  - subtitle.vtt      (WebVTT 字幕)');
  console.log('  - subtitle.json     (JSON 格式)');
  console.log('  - subtitle.lrc      (LRC 歌词)');
  
} catch (error) {
  console.error('\n✗ 转录失败:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
