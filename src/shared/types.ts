// 共享类型定义

// 视频信息
export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

// 转录片段
export interface TranscriptSegment {
  id: string;
  startTime: number;  // 秒
  endTime: number;    // 秒
  text: string;       // 原文
  translatedText?: string;  // 翻译文本
  speaker?: string;   // 说话人
  language: 'ja' | 'en';
}

// 应用配置
export interface AppConfig {
  whisperModelPath: string;
  translationModelPath: string;
  defaultSourceLanguage: 'ja' | 'en';
  defaultTargetLanguage: 'zh';
  outputDirectory: string;
  audioFormat: 'wav' | 'mp3';
}

// 处理状态
export interface ProcessingStatus {
  stage: 'idle' | 'extracting' | 'transcribing' | 'translating' | 'completed' | 'error';
  progress: number;  // 0-100
  message: string;
}

// IPC 通道
export const IpcChannels = {
  // 视频处理
  SELECT_VIDEO: 'select-video',
  SELECT_AUDIO: 'select-audio',
  EXTRACT_AUDIO: 'extract-audio',
  GET_VIDEO_INFO: 'get-video-info',
  
  // Whisper
  LOAD_WHISPER_MODEL: 'load-whisper-model',
  TRANSCRIBE_AUDIO: 'transcribe-audio',
  
  // 翻译
  TRANSLATE_TEXT: 'translate-text',
  BATCH_TRANSLATE: 'batch-translate',
  
  // 配置
  GET_CONFIG: 'get-config',
  UPDATE_CONFIG: 'update-config',
  
  // 文件操作
  SELECT_FILE: 'select-file',
  SELECT_FOLDER: 'select-folder',
  READ_FILE: 'read-file',
  READ_AUDIO_BUFFER: 'read-audio-buffer',
  SAVE_SUBTITLES: 'save-subtitles',
  
  // 状态更新
  PROCESSING_STATUS: 'processing-status',
  ERROR: 'error',
  
  // 模型管理
  GET_MODELS_STATUS: 'get-models-status',
  DOWNLOAD_MODEL: 'download-model',
  DELETE_MODEL: 'delete-model',
  GET_MODEL_PATH: 'get-model-path',
} as const;

// 字幕导出格式
export type SubtitleFormat = 'srt' | 'vtt' | 'json';

// 导出选项
export interface ExportOptions {
  format: SubtitleFormat;
  includeOriginal: boolean;
  includeTranslation: boolean;
  includeSpeaker: boolean;
}

// 模型信息
export interface ModelInfo {
  name: string;
  displayName: string;
  url: string;
  size: number;
  required: boolean;
  description: string;
  downloaded: boolean;
  path: string;
}

// 下载进度
export interface DownloadProgress {
  modelName: string;
  progress: number;
  downloaded: number;
  total: number;
  speed?: number;
}
