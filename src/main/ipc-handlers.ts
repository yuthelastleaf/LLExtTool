import { ipcMain, dialog } from 'electron';
import { getMainWindow } from './main';
import { ConfigManager } from './config-manager';
import { IpcChannels, ProcessingStatus } from '../shared/types';
import { modelDownloader } from './model-downloader';
import { sakuraTranslator } from '../services/sakura-translator';
import * as path from 'path';
import * as fs from 'fs';

const configManager = new ConfigManager();
const bindings = require('bindings');

// 按照 LLAlpcEditor 模式：使用 bindings 包加载（仅视频和Whisper模块）
let llvideo: any = null;
let llwhisper: any = null;

// 初始化 native 模块（在 app.whenReady() 之后调用）
function initializeNativeModules() {
  try {
    console.log('[Native] Loading llvideo with bindings...');
    llvideo = bindings('llvideo');
    console.log('[Native] ✓ llvideo loaded');
    console.log('[Native] llvideo exports:', Object.keys(llvideo));
  } catch (error: any) {
    console.error('[Native] ✗ Failed to load llvideo:', error.message);
  }

  try {
    console.log('[Native] Loading llwhisper with bindings...');
    llwhisper = bindings('llwhisper');
    console.log('[Native] ✓ llwhisper loaded');
    console.log('[Native] llwhisper exports:', Object.keys(llwhisper));
  } catch (error: any) {
    console.error('[Native] ✗ Failed to load llwhisper:', error.message);
  }
  
  // 自动加载 SakuraLLM 模型（如果配置了）
  initializeSakuraModel();
}

// 初始化 SakuraLLM 模型
async function initializeSakuraModel() {
  try {
    const config = configManager.getConfig();
    
    if (config.sakuraModelPath && fs.existsSync(config.sakuraModelPath)) {
      console.log('[SakuraLLM] Auto-loading model from config:', config.sakuraModelPath);
      await sakuraTranslator.loadModel(config.sakuraModelPath, {
        gpuLayers: config.sakuraGpuLayers,
      });
    } else {
      console.log('[SakuraLLM] ⚠ Model not configured or file not found');
    }
  } catch (error: any) {
    console.error('[SakuraLLM] ✗ Failed to auto-load model:', error.message);
  }
}

export function setupIpcHandlers() {
  console.log('[Main] 开始设置 IPC 处理器...');
  // 在设置 IPC 处理器时初始化 native 模块
  initializeNativeModules();
  // 设置模型管理处理器
  setupModelHandlers();
  // 选择视频文件
  ipcMain.handle(IpcChannels.SELECT_VIDEO, async () => {
    console.log('[Main] SELECT_VIDEO 被调用');
    const mainWindow = getMainWindow();
    console.log('[Main] mainWindow:', mainWindow);
    if (!mainWindow) {
      console.log('[Main] mainWindow 为 null, 返回 null');
      return null;
    }
    console.log('[Main] 正在打开视频选择对话框...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'flv', 'wmv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    console.log('[Main] 对话框结果:', result);
    
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[Main] 返回路径:', result.filePaths[0]);
      return result.filePaths[0];
    }
    console.log('[Main] 用户取消选择');
    return null;
  });
  
  // 选择音频文件
  ipcMain.handle(IpcChannels.SELECT_AUDIO, async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'm4a', 'aac', 'ogg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // 选择文件
  ipcMain.handle(IpcChannels.SELECT_FILE, async (_, filters) => {
    console.log('[Main] SELECT_FILE 被调用, filters:', filters);
    const mainWindow = getMainWindow();
    console.log('[Main] mainWindow:', mainWindow);
    if (!mainWindow) {
      console.log('[Main] mainWindow 为 null, 返回 null');
      return null;
    }
    console.log('[Main] 正在打开文件选择对话框...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    console.log('[Main] 对话框结果:', result);
    
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[Main] 返回路径:', result.filePaths[0]);
      return result.filePaths[0];
    }
    console.log('[Main] 用户取消选择');
    return null;
  });

  // 选择文件夹
  ipcMain.handle(IpcChannels.SELECT_FOLDER, async () => {
    console.log('[Main] SELECT_FOLDER 被调用');
    const mainWindow = getMainWindow();
    console.log('[Main] mainWindow:', mainWindow);
    if (!mainWindow) {
      console.log('[Main] mainWindow 为 null, 返回 null');
      return null;
    }
    console.log('[Main] 正在打开文件夹选择对话框...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    console.log('[Main] 对话框结果:', result);
    
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[Main] 返回路径:', result.filePaths[0]);
      return result.filePaths[0];
    }
    console.log('[Main] 用户取消选择');
    return null;
  });

  // 获取配置
  ipcMain.handle(IpcChannels.GET_CONFIG, async () => {
    return configManager.getConfig();
  });

  // 更新配置
  ipcMain.handle(IpcChannels.UPDATE_CONFIG, async (_, config) => {
    configManager.updateConfig(config);
    return configManager.getConfig();
  });

  // 提取音频
  ipcMain.handle(IpcChannels.EXTRACT_AUDIO, async (_, videoPath: string, outputPath?: string) => {
    try {
      if (!llvideo) {
        throw new Error('llvideo module not loaded');
      }
      
      if (!outputPath) {
        const config = configManager.getConfig();
        const videoName = path.basename(videoPath, path.extname(videoPath));
        outputPath = path.join(config.outputDirectory, `${videoName}.${config.audioFormat}`);
      }

      await llvideo.extractAudio(videoPath, outputPath, configManager.getConfig().audioFormat);
      return outputPath;
    } catch (error: any) {
      throw new Error(`音频提取失败: ${error.message}`);
    }
  });

  // 获取视频信息
  ipcMain.handle(IpcChannels.GET_VIDEO_INFO, async (_, videoPath: string) => {
    try {
      if (!llvideo) {
        throw new Error('llvideo module not loaded');
      }
      return await llvideo.getVideoInfo(videoPath);
    } catch (error: any) {
      throw new Error(`获取视频信息失败: ${error.message}`);
    }
  });

  // 加载 Whisper 模型
  ipcMain.handle(IpcChannels.LOAD_WHISPER_MODEL, async (_, modelPath: string) => {
    try {
      console.log(`[Whisper] Loading model from: ${modelPath}`);
      
      if (!llwhisper) {
        throw new Error('llwhisper module not loaded');
      }
      
      // 检查文件是否存在
      const fs = require('fs');
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }
      
      const stats = fs.statSync(modelPath);
      console.log(`[Whisper] Model file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      const result = await llwhisper.loadModel(modelPath);
      if (!result) {
        throw new Error('loadModel returned false');
      }
      
      console.log('[Whisper] Model loaded successfully');
      return true;
    } catch (error: any) {
      console.error('[Whisper] Load error:', error);
      throw new Error(`加载 Whisper 模型失败: ${error.message}`);
    }
  });

  // 转录音频 - 异步处理，不阻塞
  ipcMain.handle(IpcChannels.TRANSCRIBE_AUDIO, async (event, audioPath: string, language: 'ja' | 'en') => {
    if (!llwhisper) {
      throw new Error('llwhisper module not loaded');
    }
    
    // 立即返回，告诉渲染进程已经开始处理
    console.log('[Whisper] Starting transcription in background...');
    event.sender.send('transcribe-started', { audioPath, language });
    
    // 在后台线程处理（使用 setImmediate 让出事件循环）
    setImmediate(async () => {
      try {
        console.log('[Whisper] Transcribing audio...');
        const segments = await llwhisper.transcribe(audioPath, language);
        
        // 生成唯一 ID
        const result = segments.map((seg: any, index: number) => ({
          id: `seg_${Date.now()}_${index}`,
          ...seg,
          language
        }));
        
        console.log('[Whisper] Transcription completed, sending result...');
        // 转录完成，发送结果事件
        event.sender.send('transcribe-completed', { success: true, segments: result });
      } catch (error: any) {
        console.error('[Whisper] Transcription failed:', error.message);
        event.sender.send('transcribe-completed', { 
          success: false, 
          error: `音频转录失败: ${error.message}` 
        });
      }
    });
    
    // 立即返回 null，表示异步处理中
    return null;
  });

  // 翻译文本 (SakuraLLM)
  ipcMain.handle(IpcChannels.TRANSLATE_TEXT, async (_, text: string, _sourceLang: string, _targetLang: string, options?: any) => {
    try {
      const status = sakuraTranslator.getStatus();
      if (!status.loaded) {
        console.warn('[SakuraLLM] Model not loaded, returning original text');
        return text;
      }
      
      console.log(`[SakuraLLM] Translating: ${text.substring(0, 50)}...`);
      
      const result = await sakuraTranslator.translate(text, {
        prevText: options?.prevText,
        nextText: options?.nextText,
      });
      
      console.log(`[SakuraLLM] Result: ${result.substring(0, 50)}...`);
      return result;
    } catch (error: any) {
      console.error('[SakuraLLM] Error:', error.message);
      return text; // 翻译失败，返回原文
    }
  });

  // 批量翻译 (SakuraLLM)
  ipcMain.handle(IpcChannels.BATCH_TRANSLATE, async (_, texts: string[], _sourceLang: string, _targetLang: string, extraOptions?: any) => {
    try {
      const status = sakuraTranslator.getStatus();
      if (!status.loaded) {
        console.warn('[SakuraLLM] Model not loaded, returning original texts');
        return texts;
      }
      
      console.log(`[SakuraLLM] Batch translating ${texts.length} texts...`);
      
      const results = await sakuraTranslator.translateBatch(texts, {
        useContext: extraOptions?.useContext ?? true,
      });
      
      console.log(`[SakuraLLM] Batch translation completed: ${results.length} results`);
      return results;
    } catch (error: any) {
      console.error('[SakuraLLM] Batch error:', error.message);
      return texts; // 翻译失败，返回原文
    }
  });

  // 加载 SakuraLLM 模型
  ipcMain.handle(IpcChannels.LOAD_SAKURA_MODEL, async (_, modelPath: string, gpuLayers?: number) => {
    try {
      console.log(`[SakuraLLM] Loading model from: ${modelPath}`);
      
      if (!fs.existsSync(modelPath)) {
        throw new Error(`模型文件不存在: ${modelPath}`);
      }
      
      await sakuraTranslator.loadModel(modelPath, {
        gpuLayers: gpuLayers ?? -1,
      });
      
      return { success: true, message: 'SakuraLLM 模型加载成功' };
    } catch (error: any) {
      console.error('[SakuraLLM] Load error:', error.message);
      return { success: false, message: error.message };
    }
  });

  // 卸载 SakuraLLM 模型
  ipcMain.handle(IpcChannels.UNLOAD_SAKURA_MODEL, async () => {
    try {
      await sakuraTranslator.unloadModel();
      return { success: true, message: 'SakuraLLM 模型已卸载' };
    } catch (error: any) {
      console.error('[SakuraLLM] Unload error:', error.message);
      return { success: false, message: error.message };
    }
  });

  // 获取 SakuraLLM 状态
  ipcMain.handle(IpcChannels.GET_SAKURA_STATUS, async () => {
    return sakuraTranslator.getStatus();
  });

  // 保存字幕
  ipcMain.handle(IpcChannels.SAVE_SUBTITLES, async (_, segments, options) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: `subtitles.${options.format}`,
        filters: [
          { name: 'SubRip', extensions: ['srt'] },
          { name: 'WebVTT', extensions: ['vtt'] },
          { name: 'JSON', extensions: ['json'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        let content = '';
        
        if (options.format === 'srt') {
          content = generateSRT(segments, options);
        } else if (options.format === 'vtt') {
          content = generateVTT(segments, options);
        } else if (options.format === 'json') {
          content = JSON.stringify(segments, null, 2);
        }

        fs.writeFileSync(result.filePath, content, 'utf-8');
        return result.filePath;
      }
      return null;
    } catch (error: any) {
      throw new Error(`保存字幕失败: ${error.message}`);
    }
  });

  /** 读取文件 */
  ipcMain.handle(IpcChannels.READ_FILE, async (_, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error: any) {
      throw new Error(`读取文件失败: ${error.message}`);
    }
  });
  
  /** 读取音频文件为 ArrayBuffer */
  ipcMain.handle(IpcChannels.READ_AUDIO_BUFFER, async (_, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error: any) {
      throw new Error(`读取音频文件失败: ${error.message}`);
    }
  });
}

/** 发送状态更新 */
export function sendProcessingStatus(status: ProcessingStatus) {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(IpcChannels.PROCESSING_STATUS, status);
  }
}

// 生成 SRT 格式
function generateSRT(segments: any[], options: any): string {
  let content = '';
  segments.forEach((seg, index) => {
    content += `${index + 1}\n`;
    content += `${formatTime(seg.startTime)} --> ${formatTime(seg.endTime)}\n`;
    
    // 说话人信息（统一格式，没有则显示为空）
    if (options.includeSpeaker) {
      const speaker = seg.speaker || '';
      content += `[${speaker}]\n`;
    }
    
    // 原文和译文分行显示
    if (options.includeOriginal && seg.text) {
      content += `${seg.text}\n`;
    }
    
    if (options.includeTranslation && seg.translatedText) {
      content += `${seg.translatedText}\n`;
    }
    
    content += '\n';
  });
  return content;
}

// 生成 VTT 格式
function generateVTT(segments: any[], options: any): string {
  let content = 'WEBVTT\n\n';
  segments.forEach((seg, index) => {
    content += `${index + 1}\n`;
    content += `${formatTime(seg.startTime)} --> ${formatTime(seg.endTime)}\n`;
    
    // 说话人信息（统一格式，没有则显示为空）
    if (options.includeSpeaker) {
      const speaker = seg.speaker || '';
      content += `<v ${speaker}>`;
    }
    
    // 原文和译文分行显示
    if (options.includeOriginal && seg.text) {
      content += `${seg.text}\n`;
    }
    
    if (options.includeTranslation && seg.translatedText) {
      content += `${seg.translatedText}\n`;
    }
    
    content += '\n';
  });
  return content;
}

// 时间格式化 (秒 -> SRT 时间格式)
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0');
}

// 模型管理 IPC 处理器
function setupModelHandlers() {
  // 获取模型状态
  ipcMain.handle(IpcChannels.GET_MODELS_STATUS, async () => {
    try {
      return modelDownloader.getModelsStatus();
    } catch (error: any) {
      console.error('[Models] Error getting status:', error.message);
      throw error;
    }
  });

  // 下载模型
  ipcMain.handle(IpcChannels.DOWNLOAD_MODEL, async (_, modelName: string) => {
    try {
      const models = modelDownloader.getModelsStatus();
      const model = models.find(m => m.name === modelName);
      
      if (!model) {
        throw new Error(`Model not found: ${modelName}`);
      }

      console.log(`[Models] Downloading ${modelName}...`);
      
      const modelPath = await modelDownloader.downloadModel(model, (progress, downloaded, total) => {
        // 发送进度更新到渲染进程
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('model-download-progress', {
            modelName,
            progress,
            downloaded,
            total
          });
        }
      });

      console.log(`[Models] ✓ Downloaded ${modelName} to ${modelPath}`);
      return { success: true, path: modelPath };
    } catch (error: any) {
      console.error(`[Models] ✗ Download failed:`, error.message);
      throw new Error(`模型下载失败: ${error.message}`);
    }
  });

  // 删除模型
  ipcMain.handle(IpcChannels.DELETE_MODEL, async (_, modelName: string) => {
    try {
      const success = modelDownloader.deleteModel(modelName);
      if (success) {
        console.log(`[Models] Deleted ${modelName}`);
      }
      return { success };
    } catch (error: any) {
      console.error(`[Models] Delete failed:`, error.message);
      throw error;
    }
  });

  // 获取模型路径
  ipcMain.handle(IpcChannels.GET_MODEL_PATH, async (_, modelName: string) => {
    try {
      return modelDownloader.getModelPath(modelName);
    } catch (error: any) {
      throw error;
    }
  });
}
