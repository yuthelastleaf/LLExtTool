/**
 * Whisper.cpp Native Bindings for Node.js
 * 
 * This module provides TypeScript bindings for Whisper speech recognition
 * with support for advanced parameters similar to whisper-cli.
 * 
 * @example
 * ```typescript
 * import whisper from './build/bin/Release/llwhisper.node';
 * 
 * // Load model
 * whisper.loadModel('models/whisper/ggml-large-v2.bin');
 * 
 * // Simple transcription
 * const segments = whisper.transcribe('audio.wav', 'ja');
 * 
 * // Advanced transcription with parameters
 * const advancedSegments = whisper.transcribe('audio.wav', {
 *   language: 'ja',
 *   entropy_thold: 2.8,
 *   logprob_thold: -0.5,
 *   suppress_nst: true,
 *   n_threads: 8
 * });
 * 
 * // Export to SRT format
 * const srt = whisper.exportToSrt(segments);
 * ```
 */

export interface TranscriptSegment {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Transcribed text */
  text: string;
}

/**
 * Whisper transcription parameters
 * Similar to whisper-cli command line options
 */
export interface WhisperParams {
  /** Language code ('en', 'zh', 'ja', 'auto', etc.) */
  language?: string;
  /** Translate to English */
  translate?: boolean;
  /** Number of threads to use (default: 4) */
  n_threads?: number;
  /** Time offset in milliseconds */
  offset_ms?: number;
  /** Duration to process in milliseconds (0 = all) */
  duration_ms?: number;
  /** Entropy threshold (-et, default: 2.4) */
  entropy_thold?: number;
  /** Log probability threshold (-lpt, default: -1.0) */
  logprob_thold?: number;
  /** Temperature (default: 0.0) */
  temperature?: number;
  /** Suppress non-speech tokens (--suppress-nst) */
  suppress_nst?: boolean;
  /** Number of best candidates (default: 5) */
  best_of?: number;
  /** Beam size for beam search (-1 = disable) */
  beam_size?: number;
  /** Print timestamps (default: true) */
  print_timestamps?: boolean;
  /** Print progress (default: false) */
  print_progress?: boolean;
}

/**
 * Load Whisper model from file
 * 
 * @param modelPath Path to the GGML model file
 * @returns true if model loaded successfully
 * @throws Error if model file not found or invalid
 * 
 * @example
 * ```typescript
 * whisper.loadModel('F:\\ollama\\model\\whisper-large-v2-gglm\\ggml-large-v2-f16.bin');
 * ```
 */
export function loadModel(modelPath: string): boolean;

/**
 * Transcribe audio file to text
 * 
 * @param audioPath Path to audio file (WAV, MP3, etc.)
 * @param options Language code string or WhisperParams object
 * @returns Array of transcript segments with timestamps
 * @throws Error if model not loaded or transcription fails
 * 
 * @example
 * ```typescript
 * // Simple usage with language code
 * const segments = whisper.transcribe('audio.wav', 'ja');
 * 
 * // Advanced usage with parameters (equivalent to whisper-cli)
 * // whisper-cli -m model.bin -f audio.wav -l ja -pp --suppress-nst -et 2.8 -lpt -0.5 -osrt -otxt
 * const segments = whisper.transcribe('audio.wav', {
 *   language: 'ja',
 *   suppress_nst: true,
 *   entropy_thold: 2.8,
 *   logprob_thold: -0.5,
 *   n_threads: 8
 * });
 * 
 * segments.forEach(seg => {
 *   console.log(`[${seg.startTime}s - ${seg.endTime}s] ${seg.text}`);
 * });
 * ```
 */
export function transcribe(audioPath: string, options?: string | WhisperParams): TranscriptSegment[];

/**
 * Export segments to plain text format (-otxt)
 * 
 * @param segments Transcript segments
 * @returns Plain text output
 */
export function exportToTxt(segments: TranscriptSegment[]): string;

/**
 * Export segments to SRT subtitle format (-osrt)
 * 
 * @param segments Transcript segments
 * @returns SRT formatted text
 */
export function exportToSrt(segments: TranscriptSegment[]): string;

/**
 * Export segments to VTT subtitle format
 * 
 * @param segments Transcript segments
 * @returns VTT formatted text
 */
export function exportToVtt(segments: TranscriptSegment[]): string;

/**
 * Export segments to JSON format
 * 
 * @param segments Transcript segments
 * @returns JSON formatted text
 */
export function exportToJson(segments: TranscriptSegment[]): string;

/**
 * Export segments to LRC lyrics format
 * 
 * @param segments Transcript segments
 * @returns LRC formatted text
 */
export function exportToLrc(segments: TranscriptSegment[]): string;
