const { ipcRenderer } = require('electron');
const { IpcChannels } = require('../shared/types');

// 状态管理
let currentConfig: any = null;
let currentSegments: any[] = [];
let currentVideoPath: string | null = null;
let speakers: string[] = ['说话人A', '说话人B', '说话人C'];

// DOM 元素
const elements = {
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
    subtitleList: document.getElementById('subtitleList') as HTMLDivElement,
    exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
    addSpeakerBtn: document.getElementById('addSpeakerBtn') as HTMLButtonElement,
    
    // 设置
    settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
    settingsModal: document.getElementById('settingsModal') as HTMLDivElement,
    whisperModelPath: document.getElementById('whisperModelPath') as HTMLInputElement,
    translationModelPath: document.getElementById('translationModelPath') as HTMLInputElement,
    outputDirectory: document.getElementById('outputDirectory') as HTMLInputElement,
};

// 初始化
async function init() {
    await loadConfig();
    setupEventListeners();
}

// 加载配置
async function loadConfig() {
    try {
        currentConfig = await ipcRenderer.invoke(IpcChannels.GET_CONFIG);
        updateConfigUI();
    } catch (error: any) {
        showError('加载配置失败: ' + error.message);
    }
}

// 更新配置 UI
function updateConfigUI() {
    if (!currentConfig) return;
    
    elements.whisperModelPath.value = currentConfig.whisperModelPath || '';
    elements.translationModelPath.value = currentConfig.translationModelPath || '';
    elements.outputDirectory.value = currentConfig.outputDirectory || '';
    elements.sourceLanguage.value = currentConfig.defaultSourceLanguage;
    elements.audioFormat.value = currentConfig.audioFormat;
}

// 设置事件监听
function setupEventListeners() {
    // 视频选择
    elements.selectVideoBtn.addEventListener('click', selectVideo);
    
    // 处理按钮
    elements.processBtn.addEventListener('click', processVideo);
    
    // 导出按钮
    elements.exportBtn.addEventListener('click', exportSubtitles);
    
    // 添加说话人
    elements.addSpeakerBtn.addEventListener('click', addSpeaker);
    
    // 设置按钮
    elements.settingsBtn?.addEventListener('click', () => {
        elements.settingsModal?.classList.remove('hidden');
    });
    
    // 设置对话框
    document.querySelector('.close-btn')?.addEventListener('click', () => {
        elements.settingsModal?.classList.add('hidden');
    });
    
    document.getElementById('cancelSettingsBtn')?.addEventListener('click', () => {
        elements.settingsModal?.classList.add('hidden');
    });
    
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    
    // 模型路径选择
    document.getElementById('selectWhisperModelBtn')?.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'Model Files', extensions: ['bin'] }
        ]);
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

// 选择视频
async function selectVideo() {
    try {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_VIDEO);
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
        
        // 4. 翻译
        updateProcessingStatus({
            stage: 'translating',
            progress: 70,
            message: '正在翻译字幕...'
        });
        
        const texts = segments.map((seg: any) => seg.text);
        const translations = await ipcRenderer.invoke(
            IpcChannels.BATCH_TRANSLATE,
            texts,
            elements.sourceLanguage!.value,
            elements.targetLanguage!.value
        );
        
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
                <button class="btn btn-secondary btn-edit" data-index="${index}">编辑</button>
                <button class="btn btn-danger btn-delete" data-index="${index}">删除</button>
            </div>
        </div>
        <div class="subtitle-content">
            <div class="subtitle-text original">
                <div class="subtitle-label">原文 (${segment.language})</div>
                <textarea class="text-original" data-index="${index}">${segment.text}</textarea>
            </div>
            <div class="subtitle-text translation">
                <div class="subtitle-label">译文 (中文)</div>
                <textarea class="text-translation" data-index="${index}">${segment.translatedText || ''}</textarea>
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
    
    div.querySelector('.btn-delete')?.addEventListener('click', () => {
        currentSegments.splice(index, 1);
        displaySubtitles();
    });
    
    return div;
}

// 添加说话人
function addSpeaker() {
    const name = prompt('请输入说话人名称:');
    if (name && !speakers.includes(name)) {
        speakers.push(name);
        displaySubtitles();
    }
}

// 导出字幕
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

// 启动应用
init().catch(console.error);
