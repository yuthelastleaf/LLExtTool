import { ipcMain, dialog } from 'electron';
import { mainWindow } from './main';
import { ConfigManager } from './config-manager';
import { IpcChannels, ProcessingStatus } from '../shared/types';
import * as path from 'path';
import * as fs from 'fs';

const configManager = new ConfigManager();
const bindings = require('bindings');

// 按照 LLAlpcEditor 模式：使用 bindings 包加载
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
}

export function setupIpcHandlers() {
  // 在设置 IPC 处理器时初始化 native 模块
  initializeNativeModules();
  // 选择视频文件
  ipcMain.handle(IpcChannels.SELECT_VIDEO, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'flv', 'wmv'] },
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
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // 选择文件夹
  ipcMain.handle(IpcChannels.SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
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

  // 转录音频
  ipcMain.handle(IpcChannels.TRANSCRIBE_AUDIO, async (_, audioPath: string, language: 'ja' | 'en') => {
    try {
      if (!llwhisper) {
        throw new Error('llwhisper module not loaded');
      }
      const segments = await llwhisper.transcribe(audioPath, language);
      
      // 生成唯一 ID
      return segments.map((seg: any, index: number) => ({
        id: `seg_${Date.now()}_${index}`,
        ...seg,
        language
      }));
    } catch (error: any) {
      throw new Error(`音频转录失败: ${error.message}`);
    }
  });

  // 翻译文本
  ipcMain.handle(IpcChannels.TRANSLATE_TEXT, async (_, text: string, sourceLang: string, targetLang: string) => {
    try {
      // TODO: 这里需要集成翻译模型
      // 暂时返回占位文本
      return `[翻译] ${text}`;
    } catch (error: any) {
      throw new Error(`翻译失败: ${error.message}`);
    }
  });

  // 批量翻译
  ipcMain.handle(IpcChannels.BATCH_TRANSLATE, async (_, texts: string[], sourceLang: string, targetLang: string) => {
    try {
      // TODO: 批量翻译实现
      return texts.map(text => `[翻译] ${text}`);
    } catch (error: any) {
      throw new Error(`批量翻译失败: ${error.message}`);
    }
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
}

// 发送状态更新
export function sendProcessingStatus(status: ProcessingStatus) {
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
    
    if (options.includeSpeaker && seg.speaker) {
      content += `[${seg.speaker}] `;
    }
    
    if (options.includeOriginal) {
      content += seg.text;
      if (options.includeTranslation && seg.translatedText) {
        content += `\n${seg.translatedText}`;
      }
    } else if (options.includeTranslation && seg.translatedText) {
      content += seg.translatedText;
    }
    
    content += '\n\n';
  });
  return content;
}

// 生成 VTT 格式
function generateVTT(segments: any[], options: any): string {
  let content = 'WEBVTT\n\n';
  segments.forEach((seg, index) => {
    content += `${index + 1}\n`;
    content += `${formatTime(seg.startTime)} --> ${formatTime(seg.endTime)}\n`;
    
    if (options.includeSpeaker && seg.speaker) {
      content += `<v ${seg.speaker}>`;
    }
    
    if (options.includeOriginal) {
      content += seg.text;
      if (options.includeTranslation && seg.translatedText) {
        content += `\n${seg.translatedText}`;
      }
    } else if (options.includeTranslation && seg.translatedText) {
      content += seg.translatedText;
    }
    
    content += '\n\n';
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
