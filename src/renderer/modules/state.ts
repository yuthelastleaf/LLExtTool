/**
 * 渲染器全局状态管理
 */

import type { TranscriptSegment, AppConfig } from '../../shared/types';
import type { Role, FinetuneDataItem, DOMElements } from './types';

/** 全局状态对象 */
export const state = {
    /** 当前配置 */
    currentConfig: null as AppConfig | null,
    
    /** 当前字幕段 */
    currentSegments: [] as TranscriptSegment[],
    
    /** 当前视频路径 */
    currentVideoPath: null as string | null,
    
    /** 当前音频路径 */
    currentAudioPath: null as string | null,
    
    /** 是否为音频模式 */
    isAudioMode: false,
    
    /** 是否为批量处理模式 */
    isBatchMode: false,
    
    /** 批量处理目录路径 */
    batchDirPath: null as string | null,
    
    /** 批量处理文件列表 */
    batchFiles: [] as string[],
    
    /** 说话人列表 */
    speakers: ['说话人A', '说话人B', '说话人C'] as string[],
    
    /** 当前字幕索引 */
    currentSegmentIndex: 0,
    
    /** 是否显示原文 */
    showOriginalText: false,
    
    /** 音频缓冲区 */
    audioBuffer: null as AudioBuffer | null,
    
    /** 音频上下文 */
    audioContext: null as AudioContext | null,
    
    /** 音频源节点 */
    audioSource: null as AudioBufferSourceNode | null,
    
    /** 是否正在播放 */
    isPlaying: false,
    
    /** 播放开始时间 */
    playbackStartTime: 0,
    
    /** 暂停位置 */
    pausedAt: 0,
    
    /** 角色列表 */
    roles: [] as Role[],
    
    // ==================== 微调数据编辑器状态 ====================
    
    /** 微调数据集 (ChatML 格式对话列表) */
    finetuneDataset: [] as FinetuneDataItem[],
    
    /** 全局系统提示词 (角色人格) */
    globalSystemPrompt: '你是由西片暗恋的对象"高木同学"。你是一个初中女生，性格聪明、调皮，喜欢观察西片并温柔地捉弄他。你的说话语气通常轻松、带着笑意，喜欢用反问句，能够敏锐地看穿西片的谎言。虽然喜欢捉弄西片，但内心对他有着深厚的好感。',
    
    /** 当前选中的对话索引 */
    selectedFinetuneIndex: -1,
    
    /** 当前正在编辑的对话 (临时副本) */
    editingConversation: null as FinetuneDataItem | null,
    
    /** 源列表中选中的索引 */
    selectedSourceIndices: new Set<number>(),
};

// ==================== 状态修改函数 ====================

export function addSpeaker(name: string) {
    if (!state.speakers.includes(name)) {
        state.speakers.push(name);
    }
}

export function addRole(role: Role) {
    state.roles.push(role);
}

export function removeRole(roleId: string) {
    state.roles = state.roles.filter(r => r.id !== roleId);
}

// ==================== 微调状态修改函数 ====================

export function addFinetuneItem(item: FinetuneDataItem) {
    state.finetuneDataset.push(item);
}

export function removeFinetuneItem(index: number) {
    state.finetuneDataset.splice(index, 1);
}

export function updateFinetuneItem(index: number, item: FinetuneDataItem) {
    if (index >= 0 && index < state.finetuneDataset.length) {
        state.finetuneDataset[index] = item;
    }
}

export function setEditingConversation(item: FinetuneDataItem | null) {
    state.editingConversation = item;
}

export function toggleSourceIndex(index: number) {
    if (state.selectedSourceIndices.has(index)) {
        state.selectedSourceIndices.delete(index);
    } else {
        state.selectedSourceIndices.add(index);
    }
}

export function clearSourceIndices() {
    state.selectedSourceIndices.clear();
}

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
export const elements: { current: DOMElements | null } = { current: null };

/** 初始化 DOM 元素引用 */
export function initElements(): DOMElements {
    const els: DOMElements = {
        // 视频选择
        videoPath: document.getElementById('videoPath') as HTMLInputElement,
        selectVideoBtn: document.getElementById('selectVideoBtn') as HTMLButtonElement,
        videoInfo: document.getElementById('videoInfo') as HTMLDivElement,
        
        // 控制
        processBtn: document.getElementById('processBtn') as HTMLButtonElement,
        sourceLanguage: document.getElementById('sourceLanguage') as HTMLSelectElement,
        targetLanguage: document.getElementById('targetLanguage') as HTMLSelectElement,
        audioFormat: document.getElementById('audioFormat') as HTMLSelectElement,
        
        // 状态
        statusPanel: document.getElementById('statusPanel') as HTMLDivElement,
        
        // 字幕列表
        importBtn: document.getElementById('importBtn') as HTMLButtonElement,
        importAudioBtn: document.getElementById('importAudioBtn') as HTMLButtonElement,
        exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
        
        // 设置
        settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
        settingsModal: document.getElementById('settingsModal') as HTMLDivElement,
        whisperModelPath: document.getElementById('whisperModelPath') as HTMLInputElement,
        sakuraModelPath: document.getElementById('sakuraModelPath') as HTMLInputElement,
        sakuraGpuLayers: document.getElementById('sakuraGpuLayers') as HTMLSelectElement,
        outputDirectory: document.getElementById('outputDirectory') as HTMLInputElement,
        defaultSourceLanguage: document.getElementById('defaultSourceLanguage') as HTMLSelectElement,
        defaultTargetLanguage: document.getElementById('defaultTargetLanguage') as HTMLSelectElement,
        
        // 添加说话人对话框
        addSpeakerModal: document.getElementById('addSpeakerModal') as HTMLDivElement,
        speakerNameInput: document.getElementById('speakerNameInput') as HTMLInputElement,
        
        // 工作区切换
        editModeBtn: document.getElementById('editModeBtn') as HTMLButtonElement,
        overviewModeBtn: document.getElementById('overviewModeBtn') as HTMLButtonElement,
        editModeContainer: document.getElementById('editModeContainer') as HTMLDivElement,
        overviewModeContainer: document.getElementById('overviewModeContainer') as HTMLDivElement,
        overviewTableBody: document.getElementById('overviewTableBody') as HTMLTableSectionElement,
        speakerFilter: document.getElementById('speakerFilter') as HTMLSelectElement,
        overviewSearchInput: document.getElementById('overviewSearchInput') as HTMLInputElement,
        
        // 音频播放控制
        playPauseBtn: document.getElementById('playPauseBtn') as HTMLButtonElement,
        currentTime: document.getElementById('currentTime') as HTMLSpanElement,
        totalDuration: document.getElementById('totalDuration') as HTMLSpanElement,
        
        // 文件类型切换
        videoModeBtn: document.getElementById('videoModeBtn') as HTMLButtonElement,
        audioModeBtn: document.getElementById('audioModeBtn') as HTMLButtonElement,
        videoFileGroup: document.getElementById('videoFileGroup') as HTMLDivElement,
        audioFileGroup: document.getElementById('audioFileGroup') as HTMLDivElement,
        audioPath: document.getElementById('audioPath') as HTMLInputElement,
        selectAudioBtn: document.getElementById('selectAudioBtn') as HTMLButtonElement,
        
        // 批量处理模式
        batchModeBtn: document.getElementById('batchModeBtn') as HTMLButtonElement,
        batchDirGroup: document.getElementById('batchDirGroup') as HTMLDivElement,
        batchDirPath: document.getElementById('batchDirPath') as HTMLInputElement,
        selectBatchDirBtn: document.getElementById('selectBatchDirBtn') as HTMLButtonElement,
        batchFileCount: document.getElementById('batchFileCount') as HTMLElement,
    };
    
    elements.current = els;
    return els;
}

/** 获取 DOM 元素（带非空断言） */
export function getElements(): DOMElements {
    if (!elements.current) {
        throw new Error('DOM elements not initialized. Call initElements() first.');
    }
    return elements.current;
}
