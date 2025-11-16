/**
 * Native FFmpeg Module Type Definitions
 * 提供视频音频处理功能的 Native 模块类型定义
 */

declare module 'llvideo' {
  /**
   * 音频提取选项
   */
  export interface AudioExtractionOptions {
    /**
     * 采样率 (Hz)
     * @default 16000
     * @example 16000, 22050, 44100, 48000
     */
    sampleRate?: number;

    /**
     * 声道数
     * @default 1
     * @example 1 (单声道), 2 (立体声)
     */
    channels?: number;

    /**
     * 音频编码器
     * @default "pcm_s16le"
     * @example "pcm_s16le", "mp3", "aac", "flac"
     */
    codec?: string;

    /**
     * 输出格式
     * @default "wav"
     * @example "wav", "mp3", "flac", "m4a"
     */
    format?: string;

    /**
     * 比特率 (bps)
     * @default 0 (自动)
     * @example 128000, 192000, 320000
     */
    bitrate?: number;

    /**
     * 开始时间 (秒)
     * @default 0.0
     */
    startTime?: number;

    /**
     * 持续时间 (秒)
     * @default 0.0 (全部)
     */
    duration?: number;
  }

  /**
   * 视频信息
   */
  export interface VideoInfo {
    /** 容器格式 (例如: "mp4", "avi", "mkv") */
    format: string;

    /** 视频宽度 (像素) */
    width: number;

    /** 视频高度 (像素) */
    height: number;

    /** 持续时间 (秒) */
    duration: number;

    /** 帧率 (fps) */
    fps: number;

    /** 音频编码格式 */
    audioCodec: string;

    /** 视频编码格式 */
    videoCodec: string;

    /** 音频采样率 (Hz) */
    audioSampleRate: number;

    /** 音频声道数 */
    audioChannels: number;

    /** 比特率 (bps) */
    bitrate: number;

    /** 是否包含音频流 */
    hasAudio: boolean;

    /** 是否包含视频流 */
    hasVideo: boolean;
  }

  /**
   * 提取视频中的音频
   * 
   * @param inputPath - 输入视频文件路径
   * @param outputPath - 输出音频文件路径
   * @param options - 音频提取选项 (可选)
   * @returns Promise<true> - 成功时返回 true
   * @throws Error - 提取失败时抛出错误
   * 
   * @example
   * ```typescript
   * // 提取音频为 16kHz 单声道 WAV (适合语音识别)
   * await extractAudio('video.mp4', 'audio.wav', {
   *   sampleRate: 16000,
   *   channels: 1,
   *   codec: 'pcm_s16le',
   *   format: 'wav'
   * });
   * 
   * // 提取音频为 MP3
   * await extractAudio('video.mp4', 'audio.mp3', {
   *   sampleRate: 44100,
   *   channels: 2,
   *   codec: 'mp3',
   *   format: 'mp3',
   *   bitrate: 192000
   * });
   * 
   * // 提取部分音频 (从 10 秒开始，持续 30 秒)
   * await extractAudio('video.mp4', 'audio.wav', {
   *   startTime: 10,
   *   duration: 30
   * });
   * ```
   */
  export function extractAudio(
    inputPath: string,
    outputPath: string,
    options?: AudioExtractionOptions
  ): boolean;

  /**
   * 获取视频文件信息
   * 
   * @param inputPath - 输入视频文件路径
   * @returns VideoInfo - 视频信息对象
   * @throws Error - 读取失败时抛出错误
   * 
   * @example
   * ```typescript
   * const info = getVideoInfo('video.mp4');
   * console.log(`Duration: ${info.duration}s`);
   * console.log(`Resolution: ${info.width}x${info.height}`);
   * console.log(`FPS: ${info.fps}`);
   * console.log(`Has Audio: ${info.hasAudio}`);
   * ```
   */
  export function getVideoInfo(inputPath: string): VideoInfo;

  /**
   * 检查文件是否为有效的媒体文件
   * 
   * @param inputPath - 输入文件路径
   * @returns boolean - 如果是有效的媒体文件则返回 true
   * 
   * @example
   * ```typescript
   * if (isValidMediaFile('video.mp4')) {
   *   console.log('Valid media file');
   * }
   * ```
   */
  export function isValidMediaFile(inputPath: string): boolean;

  /**
   * 获取最后一次操作的错误信息
   * 
   * @returns string - 错误信息，如果没有错误则返回空字符串
   * 
   * @example
   * ```typescript
   * try {
   *   extractAudio('input.mp4', 'output.wav');
   * } catch (error) {
   *   console.error('FFmpeg Error:', getLastError());
   * }
   * ```
   */
  export function getLastError(): string;
}

// 默认导出
declare module '*/build/Release/llvideo.node' {
  export * from 'llvideo';
}
