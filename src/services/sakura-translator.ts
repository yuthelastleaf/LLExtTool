/**
 * SakuraLLM 翻译服务
 * 使用 node-llama-cpp 加载 GGUF 模型进行日译中翻译
 */

// node-llama-cpp 是 ESM 模块，需要动态导入
// 类型声明
type LlamaModule = typeof import('node-llama-cpp');
type Llama = Awaited<ReturnType<LlamaModule['getLlama']>>;
type LlamaModel = Awaited<ReturnType<Llama['loadModel']>>;
type LlamaContext = Awaited<ReturnType<LlamaModel['createContext']>>;

// SakuraLLM 的 prompt 模板
const SAKURA_SYSTEM_PROMPT = `你是一个轻小说翻译模型，可以流畅通顺地以日本轻小说的风格将日文翻译成简体中文，并联系上下文正确使用人称代词，不擅自添加原文中没有的代词。`;

export interface SakuraTranslatorOptions {
  gpuLayers?: number;  // GPU 层数，-1 表示全部
}

export interface TranslateOptions {
  prevText?: string;   // 上一句（上下文）
  nextText?: string;   // 下一句（上下文）
}

// 使用 Function 构造器来绕过 TypeScript 将 import() 转换为 require()
// 这是在 CommonJS 环境中加载 ESM 模块的标准方法
const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (modulePath: string) => Promise<any>;

// 动态导入 node-llama-cpp
let llamaModule: LlamaModule | null = null;
async function getLlamaModule(): Promise<LlamaModule> {
  if (!llamaModule) {
    llamaModule = await dynamicImport('node-llama-cpp');
  }
  return llamaModule!;
}

export class SakuraTranslator {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private modelPath: string = '';
  private isLoaded: boolean = false;
  private gpuLayers: number = -1;

  /**
   * 加载模型
   */
  async loadModel(modelPath: string, options: SakuraTranslatorOptions = {}): Promise<boolean> {
    try {
      console.log('[SakuraLLM] Loading model from:', modelPath);
      
      // 如果已经加载了相同的模型，跳过
      if (this.isLoaded && this.modelPath === modelPath) {
        console.log('[SakuraLLM] Model already loaded');
        return true;
      }

      // 卸载旧模型
      await this.unloadModel();

      this.gpuLayers = options.gpuLayers ?? -1;
      
      // 动态加载 node-llama-cpp 模块
      const { getLlama } = await getLlamaModule();
      
      // 初始化 llama
      this.llama = await getLlama({
        gpu: this.gpuLayers === 0 ? false : 'cuda',
      });
      
      console.log('[SakuraLLM] Llama initialized, loading model...');
      
      // 加载模型
      this.model = await this.llama!.loadModel({
        modelPath: modelPath,
        gpuLayers: this.gpuLayers,
      });
      
      console.log('[SakuraLLM] Model loaded, creating context...');
      
      // 创建上下文
      this.context = await this.model.createContext({
        contextSize: 4096,  // SakuraLLM 通常使用 4096 上下文
      });
      
      this.modelPath = modelPath;
      this.isLoaded = true;
      
      console.log('[SakuraLLM] ✓ Model loaded successfully');
      return true;
    } catch (error: any) {
      console.error('[SakuraLLM] ✗ Failed to load model:', error.message);
      this.isLoaded = false;
      throw error;
    }
  }

  /**
   * 卸载模型
   */
  async unloadModel(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    if (this.llama) {
      await this.llama.dispose();
      this.llama = null;
    }
    this.isLoaded = false;
    this.modelPath = '';
    console.log('[SakuraLLM] Model unloaded');
  }

  /**
   * 翻译单个文本
   */
  async translate(text: string, options: TranslateOptions = {}): Promise<string> {
    if (!this.isLoaded || !this.context || !this.model) {
      throw new Error('Model not loaded');
    }

    let sequence: any = null;
    
    try {
      // 构建用户消息
      let userMessage = '';
      
      // 添加上下文（如果有）
      if (options.prevText) {
        userMessage += `上文：${options.prevText}\n`;
      }
      
      userMessage += `将下面的日文文本翻译成中文：${text}`;
      
      if (options.nextText) {
        userMessage += `\n下文：${options.nextText}`;
      }

      console.log('[SakuraLLM] Translating:', text.substring(0, 50) + '...');
      console.log('[SakuraLLM] User message:', userMessage);

      // 动态加载 LlamaChatSession
      const { LlamaChatSession } = await getLlamaModule();
      
      // 每次翻译创建全新独立的 context sequence，避免历史累积
      sequence = this.context.getSequence();
      
      // 创建新的聊天会话
      const session = new LlamaChatSession({
        contextSequence: sequence,
        systemPrompt: SAKURA_SYSTEM_PROMPT,
      });

      console.log('[SakuraLLM] Session created, generating response...');

      // 生成翻译
      const response = await session.prompt(userMessage, {
        maxTokens: 512,
        temperature: 0.1,  // 低温度以获得更稳定的翻译
        topP: 0.3,
      });

      console.log('[SakuraLLM] Raw response:', response);

      // 清理响应（移除可能的多余内容）
      let translation = response.trim();
      
      // 如果响应包含多行，只取第一行（主要翻译结果）
      const lines = translation.split('\n').filter((line: string) => line.trim());
      if (lines.length > 0) {
        translation = lines[0];
      }

      console.log('[SakuraLLM] Translation:', translation.substring(0, 50) + '...');
      
      return translation;
    } catch (error: any) {
      console.error('[SakuraLLM] Translation error:', error.message);
      throw error;
    } finally {
      // 释放 sequence 以便下次使用新的
      if (sequence) {
        try {
          await sequence.dispose();
        } catch (e) {
          // 忽略释放错误
        }
      }
    }
  }

  /**
   * 批量翻译
   */
  async translateBatch(texts: string[], options: { useContext?: boolean } = {}): Promise<string[]> {
    if (!this.isLoaded) {
      throw new Error('Model not loaded');
    }

    const results: string[] = [];
    const useContext = options.useContext ?? true;

    for (let i = 0; i < texts.length; i++) {
      const translateOptions: TranslateOptions = {};
      
      // 使用上下文
      if (useContext) {
        if (i > 0) {
          translateOptions.prevText = texts[i - 1];
        }
        if (i < texts.length - 1) {
          translateOptions.nextText = texts[i + 1];
        }
      }

      try {
        const translation = await this.translate(texts[i], translateOptions);
        results.push(translation);
      } catch (error) {
        console.error(`[SakuraLLM] Failed to translate item ${i}:`, error);
        results.push(texts[i]); // 失败时返回原文
      }

      // 每翻译 10 条输出进度
      if ((i + 1) % 10 === 0 || i === texts.length - 1) {
        console.log(`[SakuraLLM] Progress: ${i + 1}/${texts.length}`);
      }
    }

    return results;
  }

  /**
   * 获取状态
   */
  getStatus(): { loaded: boolean; modelPath: string; gpuLayers: number } {
    return {
      loaded: this.isLoaded,
      modelPath: this.modelPath,
      gpuLayers: this.gpuLayers,
    };
  }
}

// 导出单例
export const sakuraTranslator = new SakuraTranslator();
