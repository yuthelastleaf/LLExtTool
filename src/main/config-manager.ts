import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppConfig } from '../shared/types';

const CONFIG_FILE_NAME = 'llexttool-config.json';

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), CONFIG_FILE_NAME);
    this.config = this.loadConfig();
  }

  private getDefaultConfig(): AppConfig {
    // 默认模型路径（相对于项目根目录）
    const appRoot = process.env.NODE_ENV === 'development' 
      ? path.resolve(__dirname, '..', '..')
      : path.dirname(app.getPath('exe'));
    
    const defaultWhisperModelPath = path.join(appRoot, 'native', 'whisper.cpp', 'models', 'ggml-large-v2-f16.bin');
    const defaultTranslateModelDir = path.join(appRoot, 'native', 'model', 'm2m100-ct2');
    const defaultTranslateTokenizerPath = path.join(appRoot, 'native', 'model', 'm2m100_418M', 'sentencepiece.bpe.model');
    
    return {
      whisperModelPath: fs.existsSync(defaultWhisperModelPath) ? defaultWhisperModelPath : '',
      translationModelPath: fs.existsSync(defaultTranslateModelDir) ? defaultTranslateModelDir : '',
      translationTokenizerPath: fs.existsSync(defaultTranslateTokenizerPath) ? defaultTranslateTokenizerPath : '',
      translationModelType: 'm2m100',
      defaultSourceLanguage: 'ja',
      defaultTargetLanguage: 'zh',
      outputDirectory: app.getPath('documents'),
      audioFormat: 'wav',
    };
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const savedConfig = JSON.parse(data);
        return { ...this.getDefaultConfig(), ...savedConfig };
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    return this.getDefaultConfig();
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
}
