/**
 * 渲染器模块类型定义
 */

export type { TranscriptSegment, AppConfig } from '../../shared/types';

/** 角色定义 */
export interface Role {
    id: string;
    name: string;
    color: string;
}

/** ChatML 消息 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** 微调数据项 (ChatML 格式) */
export interface FinetuneDataItem {
    id: string;
    type: 'chatml';
    messages: ChatMessage[];
    sourceSegmentIds?: string[];  // 对应的字幕 segment IDs
}

/** DOM 元素引用 */
export interface DOMElements {
    // 视频选择
    videoPath: HTMLInputElement;
    selectVideoBtn: HTMLButtonElement;
    videoInfo: HTMLDivElement;
    
    // 控制
    processBtn: HTMLButtonElement;
    sourceLanguage: HTMLSelectElement;
    targetLanguage: HTMLSelectElement;
    audioFormat: HTMLSelectElement;
    
    // 状态
    statusPanel: HTMLDivElement;
    
    // 字幕列表
    importBtn: HTMLButtonElement;
    importAudioBtn: HTMLButtonElement;
    exportBtn: HTMLButtonElement;
    
    // 设置
    settingsBtn: HTMLButtonElement;
    settingsModal: HTMLDivElement;
    whisperModelPath: HTMLInputElement;
    sakuraModelPath: HTMLInputElement;
    sakuraGpuLayers: HTMLSelectElement;
    outputDirectory: HTMLInputElement;
    defaultSourceLanguage: HTMLSelectElement;
    defaultTargetLanguage: HTMLSelectElement;
    
    // 添加说话人对话框
    addSpeakerModal: HTMLDivElement;
    speakerNameInput: HTMLInputElement;
    
    // 工作区切换
    editModeBtn: HTMLButtonElement;
    overviewModeBtn: HTMLButtonElement;
    editModeContainer: HTMLDivElement;
    overviewModeContainer: HTMLDivElement;
    overviewTableBody: HTMLTableSectionElement;
    speakerFilter: HTMLSelectElement;
    overviewSearchInput: HTMLInputElement;
    
    // 音频播放控制
    playPauseBtn: HTMLButtonElement;
    currentTime: HTMLSpanElement;
    totalDuration: HTMLSpanElement;
    
    // 文件类型切换
    videoModeBtn: HTMLButtonElement;
    audioModeBtn: HTMLButtonElement;
    videoFileGroup: HTMLDivElement;
    audioFileGroup: HTMLDivElement;
    audioPath: HTMLInputElement;
    selectAudioBtn: HTMLButtonElement;
    
    // 批量处理模式
    batchModeBtn: HTMLButtonElement;
    batchDirGroup: HTMLDivElement;
    batchDirPath: HTMLInputElement;
    selectBatchDirBtn: HTMLButtonElement;
    batchFileCount: HTMLElement;
}
