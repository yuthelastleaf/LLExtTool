// 模型下载管理器
import { app, BrowserWindow } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';

const streamPipeline = promisify(pipeline);

export interface ModelInfo {
  name: string;
  displayName: string;
  url: string;
  size: number; // bytes
  md5?: string;
  required: boolean;
  description: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    name: 'ggml-large-v2-f16.bin',
    displayName: 'Whisper Large v2 (推荐)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-f16.bin',
    size: 3094725684, // ~3GB
    required: true,
    description: '最高质量的语音识别模型，支持多语言'
  },
  {
    name: 'ggml-medium.bin',
    displayName: 'Whisper Medium',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    size: 1533889724, // ~1.5GB
    required: false,
    description: '中等大小模型，平衡性能和质量'
  },
  {
    name: 'opus-mt-ja-zh-ct2',
    displayName: '日译中翻译模型',
    url: 'https://huggingface.co/Helsinki-NLP/opus-mt-ja-zh',
    size: 300000000, // ~300MB
    required: false,
    description: '日语到中文的翻译模型'
  }
];

export class ModelDownloader {
  private modelsDir: string;
  private downloadWindow?: BrowserWindow;

  constructor() {
    // 模型存储在用户数据目录
    this.modelsDir = path.join(app.getPath('userData'), 'models');
    this.ensureModelsDir();
  }

  private ensureModelsDir() {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  /**
   * 检查模型是否已下载
   */
  isModelDownloaded(modelName: string): boolean {
    const modelPath = path.join(this.modelsDir, modelName);
    return fs.existsSync(modelPath);
  }

  /**
   * 获取模型路径
   */
  getModelPath(modelName: string): string {
    return path.join(this.modelsDir, modelName);
  }

  /**
   * 获取所有模型状态
   */
  getModelsStatus(): Array<ModelInfo & { downloaded: boolean; path: string }> {
    return AVAILABLE_MODELS.map(model => ({
      ...model,
      downloaded: this.isModelDownloaded(model.name),
      path: this.getModelPath(model.name)
    }));
  }

  /**
   * 下载模型
   */
  async downloadModel(
    model: ModelInfo,
    onProgress?: (progress: number, downloaded: number, total: number) => void
  ): Promise<string> {
    const modelPath = this.getModelPath(model.name);
    
    // 如果已存在，先删除
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
    }

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(modelPath);
      let downloadedBytes = 0;

      https.get(model.url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // 处理重定向
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect location not found'));
            return;
          }
          
          https.get(redirectUrl, (redirectResponse) => {
            this.handleDownloadResponse(redirectResponse, file, model, downloadedBytes, onProgress, resolve, reject);
          }).on('error', reject);
        } else {
          this.handleDownloadResponse(response, file, model, downloadedBytes, onProgress, resolve, reject);
        }
      }).on('error', (error) => {
        fs.unlinkSync(modelPath);
        reject(error);
      });
    });
  }

  private handleDownloadResponse(
    response: any,
    file: fs.WriteStream,
    model: ModelInfo,
    downloadedBytes: number,
    onProgress: ((progress: number, downloaded: number, total: number) => void) | undefined,
    resolve: (value: string) => void,
    reject: (reason?: any) => void
  ) {
    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

    response.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      if (onProgress && totalBytes > 0) {
        const progress = (downloadedBytes / totalBytes) * 100;
        onProgress(progress, downloadedBytes, totalBytes);
      }
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      resolve(this.getModelPath(model.name));
    });

    file.on('error', (error) => {
      fs.unlinkSync(this.getModelPath(model.name));
      reject(error);
    });
  }

  /**
   * 检查必需模型是否已下载
   */
  checkRequiredModels(): { missing: ModelInfo[]; allDownloaded: boolean } {
    const missing = AVAILABLE_MODELS
      .filter(m => m.required)
      .filter(m => !this.isModelDownloaded(m.name));
    
    return {
      missing,
      allDownloaded: missing.length === 0
    };
  }

  /**
   * 删除模型
   */
  deleteModel(modelName: string): boolean {
    const modelPath = this.getModelPath(modelName);
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
      return true;
    }
    return false;
  }

  /**
   * 获取模型目录大小
   */
  getModelsSize(): number {
    let totalSize = 0;
    if (fs.existsSync(this.modelsDir)) {
      const files = fs.readdirSync(this.modelsDir);
      files.forEach(file => {
        const filePath = path.join(this.modelsDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      });
    }
    return totalSize;
  }
}

export const modelDownloader = new ModelDownloader();
