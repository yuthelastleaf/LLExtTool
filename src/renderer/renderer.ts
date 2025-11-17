import type { TranscriptSegment, AppConfig, ProcessingStatus } from '../shared/types';

const { ipcRenderer } = require('electron');
const { IpcChannels } = require('../shared/types');

/** 状态管理 */
let currentConfig: AppConfig | null = null;
let currentSegments: TranscriptSegment[] = [];
let currentVideoPath: string | null = null;
let speakers: string[] = ['说话人A', '说话人B', '说话人C'];

// DOM 元素
const elements = {
    // 视频选择
    videoPath: document.getElementById('videoPath') as HTMLInputElement,
    selectVideoBtn: document.getElementById('selectVideoBtn') as HTMLButtonElement,
    videoInfo: document.getElementById('videoInfo') as HTMLDivElement,
    
    /** 控制 */
    processBtn: document.getElementById('processBtn') as HTMLButtonElement,
    sourceLanguage: document.getElementById('sourceLanguage') as HTMLSelectElement,
    targetLanguage: document.getElementById('targetLanguage') as HTMLSelectElement,
    audioFormat: document.getElementById('audioFormat') as HTMLSelectElement,
    
    /** 状态 */
    statusPanel: document.getElementById('statusPanel') as HTMLDivElement,
    
    /** 字幕列表 */
    subtitleList: document.getElementById('subtitleList') as HTMLDivElement,
    importBtn: document.getElementById('importBtn') as HTMLButtonElement,
    exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
    addSpeakerBtn: document.getElementById('addSpeakerBtn') as HTMLButtonElement,
    
    /** 设置 */
    settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
    settingsModal: document.getElementById('settingsModal') as HTMLDivElement,
    whisperModelPath: document.getElementById('whisperModelPath') as HTMLInputElement,
    translationModelPath: document.getElementById('translationModelPath') as HTMLInputElement,
    outputDirectory: document.getElementById('outputDirectory') as HTMLInputElement,
    
    /** 添加说话人对话框 */
    addSpeakerModal: document.getElementById('addSpeakerModal') as HTMLDivElement,
    speakerNameInput: document.getElementById('speakerNameInput') as HTMLInputElement,
};

/** 初始化 */
async function init() {
    console.log('[Renderer] ========== 开始初始化 ==========');
    console.log('[Renderer] init() 函数被调用');
    await loadConfig();
    setupEventListeners();
    console.log('[Renderer] ========== 初始化完成 ==========');
}

/** 加载配置 */
async function loadConfig() {
    try {
        currentConfig = await ipcRenderer.invoke(IpcChannels.GET_CONFIG);
        updateConfigUI();
    } catch (error: any) {
        showError('加载配置失败: ' + error.message);
    }
}

/** 更新配置 UI */
function updateConfigUI() {
    if (!currentConfig) return;
    
    elements.whisperModelPath.value = currentConfig.whisperModelPath || '';
    elements.translationModelPath.value = currentConfig.translationModelPath || '';
    elements.outputDirectory.value = currentConfig.outputDirectory || '';
    elements.sourceLanguage.value = currentConfig.defaultSourceLanguage;
    elements.audioFormat.value = currentConfig.audioFormat;
}

/** 设置事件监听 */
function setupEventListeners() {
    console.log('[Renderer] 开始设置事件监听器...');
    console.log('[Renderer] elements.selectVideoBtn:', elements.selectVideoBtn);
    console.log('[Renderer] elements.settingsBtn:', elements.settingsBtn);
    console.log('[Renderer] elements.settingsModal:', elements.settingsModal);
    
    /** 视频选择 */
    elements.selectVideoBtn.addEventListener('click', selectVideo);
    console.log('[Renderer] ✓ 已绑定 selectVideoBtn 点击事件');
    
    /** 导入字幕 */
    elements.importBtn.addEventListener('click', importSubtitles);
    console.log('[Renderer] ✓ 已绑定 importBtn 点击事件');
    
    /** 处理按钮 */
    elements.processBtn.addEventListener('click', processVideo);
    console.log('[Renderer] ✓ 已绑定 processBtn 点击事件');
    
    /** 导出按钮 */
    elements.exportBtn.addEventListener('click', exportSubtitles);
    console.log('[Renderer] ✓ 已绑定 exportBtn 点击事件');
    
    /** 添加说话人 */
    elements.addSpeakerBtn.addEventListener('click', addSpeaker);
    console.log('[Renderer] ✓ 已绑定 addSpeakerBtn 点击事件');
    
    /** 设置按钮 */
    elements.settingsBtn?.addEventListener('click', () => {
        console.log('[Renderer] 设置按钮被点击');
        console.log('[Renderer] settingsModal:', elements.settingsModal);
        console.log('[Renderer] settingsModal classes before:', elements.settingsModal?.classList.value);
        elements.settingsModal?.classList.remove('hidden');
        console.log('[Renderer] settingsModal classes after:', elements.settingsModal?.classList.value);
    });
    console.log('[Renderer] ✓ 已绑定 settingsBtn 点击事件');
    
    /** 设置对话框 */
    document.querySelector('.close-btn')?.addEventListener('click', () => {
        elements.settingsModal?.classList.add('hidden');
    });
    
    document.getElementById('cancelSettingsBtn')?.addEventListener('click', () => {
        elements.settingsModal?.classList.add('hidden');
    });
    
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    
    /** 添加说话人对话框 */
    document.getElementById('closeSpeakerModal')?.addEventListener('click', () => {
        elements.addSpeakerModal.classList.add('hidden');
        elements.speakerNameInput.value = '';
    });
    
    document.getElementById('cancelAddSpeaker')?.addEventListener('click', () => {
        elements.addSpeakerModal.classList.add('hidden');
        elements.speakerNameInput.value = '';
    });
    
    document.getElementById('confirmAddSpeaker')?.addEventListener('click', () => {
        const name = elements.speakerNameInput.value.trim();
        if (name && !speakers.includes(name)) {
            speakers.push(name);
            displaySubtitles();
            elements.addSpeakerModal.classList.add('hidden');
            elements.speakerNameInput.value = '';
            console.log('[Renderer] 添加说话人:', name);
        } else if (speakers.includes(name)) {
            alert('该说话人已存在！');
        } else {
            alert('请输入说话人名称！');
        }
    });
    
    // 回车键确认
    elements.speakerNameInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            document.getElementById('confirmAddSpeaker')?.click();
        }
    });
    
    /** 模型路径选择 */
    document.getElementById('selectWhisperModelBtn')?.addEventListener('click', async () => {
        console.log('[Renderer] selectWhisperModelBtn 被点击');
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'Model Files', extensions: ['bin'] }
        ]);
        console.log('[Renderer] Whisper 模型路径:', path);
        if (path) elements.whisperModelPath!.value = path;
    });
    
    document.getElementById('selectTranslationModelBtn')?.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE);
        if (path) elements.translationModelPath!.value = path;
    });
    
    document.getElementById('selectOutputDirBtn')?.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FOLDER);
        if (path) elements.outputDirectory!.value = path;
    });
    
    // 监听处理状态
    ipcRenderer.on(IpcChannels.PROCESSING_STATUS, (_: any, status: any) => {
        updateProcessingStatus(status);
    });
}

/** 选择视频 */
async function selectVideo() {
    console.log('[Renderer] selectVideo() 被调用');
    try {
        console.log('[Renderer] 正在调用 IPC:', IpcChannels.SELECT_VIDEO);
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_VIDEO);
        console.log('[Renderer] IPC 返回路径:', path);
        if (path) {
            currentVideoPath = path;
            elements.videoPath!.value = path;
            elements.processBtn!.disabled = false;
            
            // 获取视频信息
            const info = await ipcRenderer.invoke(IpcChannels.GET_VIDEO_INFO, path);
            displayVideoInfo(info);
        }
    } catch (error: any) {
        showError('选择视频失败: ' + error.message);
    }
}

// 显示视频信息
function displayVideoInfo(info: any) {
    const duration = formatDuration(info.duration);
    elements.videoInfo!.innerHTML = `
        <p><strong>时长:</strong> ${duration}</p>
        <p><strong>分辨率:</strong> ${info.width} x ${info.height}</p>
        <p><strong>帧率:</strong> ${info.fps.toFixed(2)} fps</p>
        <p><strong>音频:</strong> ${info.hasAudio ? '有' : '无'}</p>
    `;
}

// 处理视频
async function processVideo() {
    if (!currentVideoPath) return;
    
    elements.processBtn!.disabled = true;
    elements.statusPanel!.classList.remove('hidden');
    
    try {
        // 检查模型路径
        if (!currentConfig?.whisperModelPath) {
            throw new Error('请先在设置中配置 Whisper 模型路径');
        }
        
        // 1. 提取音频
        updateProcessingStatus({
            stage: 'extracting',
            progress: 0,
            message: '正在提取音频...'
        });
        
        const audioPath = await ipcRenderer.invoke(
            IpcChannels.EXTRACT_AUDIO,
            currentVideoPath
        );
        
        // 2. 加载 Whisper 模型
        updateProcessingStatus({
            stage: 'transcribing',
            progress: 30,
            message: '正在加载 Whisper 模型...'
        });
        
        await ipcRenderer.invoke(
            IpcChannels.LOAD_WHISPER_MODEL,
            currentConfig!.whisperModelPath
        );
        
        // 3. 转录音频
        updateProcessingStatus({
            stage: 'transcribing',
            progress: 40,
            message: '正在进行语音识别...'
        });
        
        const segments = await ipcRenderer.invoke(
            IpcChannels.TRANSCRIBE_AUDIO,
            audioPath,
            elements.sourceLanguage!.value
        );
        
        // 4. 翻译（如果翻译失败会返回原文）
        updateProcessingStatus({
            stage: 'translating',
            progress: 70,
            message: '正在翻译字幕...（翻译模块开发中）'
        });
        
        let translations: string[];
        try {
            const texts = segments.map((seg: any) => seg.text);
            translations = await ipcRenderer.invoke(
                IpcChannels.BATCH_TRANSLATE,
                texts,
                elements.sourceLanguage!.value,
                elements.targetLanguage!.value
            );
            console.log('[Renderer] Translation completed');
        } catch (error: any) {
            console.warn('[Renderer] Translation failed, using original text:', error.message);
            translations = segments.map((seg: any) => seg.text); // 使用原文
        }
        
        // 合并结果
        currentSegments = segments.map((seg: any, index: number) => ({
            ...seg,
            translatedText: translations[index]
        }));
        
        // 5. 完成
        updateProcessingStatus({
            stage: 'completed',
            progress: 100,
            message: '处理完成！'
        });
        
        displaySubtitles();
        elements.exportBtn!.disabled = false;
        
    } catch (error: any) {
        updateProcessingStatus({
            stage: 'error',
            progress: 0,
            message: '处理失败: ' + error.message
        });
        showError('处理失败: ' + error.message);
    } finally {
        elements.processBtn!.disabled = false;
    }
}

// 更新处理状态
function updateProcessingStatus(status: any) {
    const messageEl = elements.statusPanel!.querySelector('.status-message') as HTMLElement;
    const fillEl = elements.statusPanel!.querySelector('.progress-fill') as HTMLElement;
    const percentageEl = elements.statusPanel!.querySelector('.status-percentage') as HTMLElement;
    
    messageEl!.textContent = status.message;
    fillEl!.style.width = status.progress + '%';
    percentageEl!.textContent = Math.round(status.progress) + '%';
}

// 显示字幕列表
function displaySubtitles() {
    if (currentSegments.length === 0) {
        elements.subtitleList!.innerHTML = `
            <div class="empty-state">
                <p>暂无字幕数据</p>
            </div>
        `;
        return;
    }
    
    elements.subtitleList!.innerHTML = '';
    
    for (let index = 0; index < currentSegments.length; index++) {
        const segment = currentSegments[index];
        const item = createSubtitleItem(segment, index);
        elements.subtitleList!.appendChild(item);
    }
}

// 创建字幕项
function createSubtitleItem(segment: any, index: number) {
    const div = document.createElement('div');
    div.className = 'subtitle-item';
    div.dataset.index = String(index);
    
    const speakerOptions = speakers.map(s => 
        `<option value="${s}" ${segment.speaker === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    
    div.innerHTML = `
        <div class="subtitle-header">
            <span class="subtitle-time">${formatTime(segment.startTime)} → ${formatTime(segment.endTime)}</span>
            <div class="subtitle-actions">
                <select class="speaker-select" data-index="${index}">
                    <option value="">未分配</option>
                    ${speakerOptions}
                </select>
                <button class="btn btn-secondary btn-toggle-original" data-index="${index}" title="显示/隐藏原文">👁️</button>
                <button class="btn btn-danger btn-delete" data-index="${index}">删除</button>
            </div>
        </div>
        <div class="subtitle-content">
            <div class="subtitle-text translation">
                <textarea class="text-translation" data-index="${index}" placeholder="译文 (中文)">${segment.translatedText || ''}</textarea>
            </div>
            <div class="subtitle-text original hidden">
                <div class="subtitle-label">原文 (${segment.language})</div>
                <textarea class="text-original" data-index="${index}" readonly>${segment.text}</textarea>
            </div>
        </div>
    `;
    
    // 事件监听
    div.querySelector('.speaker-select')?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement;
        currentSegments[index].speaker = target.value;
    });
    
    div.querySelector('.text-original')?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        currentSegments[index].text = target.value;
    });
    
    div.querySelector('.text-translation')?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        currentSegments[index].translatedText = target.value;
    });
    
    div.querySelector('.btn-toggle-original')?.addEventListener('click', () => {
        const originalText = div.querySelector('.subtitle-text.original');
        originalText?.classList.toggle('hidden');
    });
    
    div.querySelector('.btn-delete')?.addEventListener('click', () => {
        currentSegments.splice(index, 1);
        displaySubtitles();
    });
    
    return div;
}

/**
 * 添加说话人
 */
function addSpeaker() {
    console.log('[Renderer] 打开添加说话人对话框');
    elements.addSpeakerModal.classList.remove('hidden');
    elements.speakerNameInput.value = '';
    elements.speakerNameInput.focus();
}

/**
 * 导入字幕
 */
async function importSubtitles() {
    try {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'Subtitle Files', extensions: ['srt', 'vtt', 'json'] }
        ]);
        
        if (!path) return;
        
        const content = await ipcRenderer.invoke(IpcChannels.READ_FILE, path);
        
        if (path.endsWith('.json')) {
            currentSegments = JSON.parse(content);
        } else if (path.endsWith('.srt')) {
            currentSegments = parseSRT(content);
        } else if (path.endsWith('.vtt')) {
            currentSegments = parseVTT(content);
        }
        
        displaySubtitles();
        elements.exportBtn.disabled = false;
        
        alert(`成功导入 ${currentSegments.length} 条字幕`);
    } catch (error: any) {
        showError('导入字幕失败: ' + error.message);
    }
}

/**
 * 解析 SRT 格式
 */
function parseSRT(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const blocks = content.trim().split('\n\n');
    
    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;
        
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!timeMatch) continue;
        
        const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + 
                         parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + 
                       parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        
        const text = lines.slice(2).join('\n');
        
        segments.push({
            id: `seg_${Date.now()}_${segments.length}`,
            startTime,
            endTime,
            text,
            language: 'ja'
        });
    }
    
    return segments;
}

/**
 * 解析 VTT 格式
 */
function parseVTT(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length && !lines[i].includes('-->')) {
        i++;
    }
    
    while (i < lines.length) {
        const line = lines[i];
        const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
        
        if (timeMatch) {
            const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + 
                             parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + 
                           parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
            
            i++;
            const textLines: string[] = [];
            while (i < lines.length && lines[i].trim() !== '') {
                textLines.push(lines[i]);
                i++;
            }
            
            segments.push({
                id: `seg_${Date.now()}_${segments.length}`,
                startTime,
                endTime,
                text: textLines.join('\n'),
                language: 'ja'
            });
        }
        i++;
    }
    
    return segments;
}

/**
 * 导出字幕
 */
async function exportSubtitles() {
    if (currentSegments.length === 0) return;
    
    try {
        const options = {
            format: 'srt',
            includeOriginal: true,
            includeTranslation: true,
            includeSpeaker: true
        };
        
        const path = await ipcRenderer.invoke(
            IpcChannels.SAVE_SUBTITLES,
            currentSegments,
            options
        );
        
        if (path) {
            alert('字幕导出成功: ' + path);
        }
    } catch (error: any) {
        showError('导出失败: ' + error.message);
    }
}

// 保存设置
async function saveSettings() {
    try {
        const updates = {
            whisperModelPath: elements.whisperModelPath.value,
            translationModelPath: elements.translationModelPath.value,
            outputDirectory: elements.outputDirectory.value,
        };
        
        currentConfig = await ipcRenderer.invoke(IpcChannels.UPDATE_CONFIG, updates);
        elements.settingsModal.classList.add('hidden');
        alert('设置已保存');
    } catch (error: any) {
        showError('保存设置失败: ' + error.message);
    }
}

// 工具函数
function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
}

function pad(num: number, size: number = 2): string {
    return num.toString().padStart(size, '0');
}

function showError(message: string): void {
    alert(message);
    console.error(message);
}

console.log('[Renderer] ========== 脚本加载完成 ==========');
console.log('[Renderer] 即将调用 init() 函数');
// 启动应用
init().catch((error) => {
    console.error('[Renderer] init() 执行出错:', error);
});
