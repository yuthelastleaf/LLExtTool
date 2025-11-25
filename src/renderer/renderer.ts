import type { TranscriptSegment, AppConfig, ProcessingStatus } from '../shared/types';

const { ipcRenderer } = require('electron');
const { IpcChannels } = require('../shared/types');

/** 状态管理 */
let currentConfig: AppConfig | null = null;
let currentSegments: TranscriptSegment[] = [];
let currentVideoPath: string | null = null;
let currentAudioPath: string | null = null;
let isAudioMode: boolean = false;  // 是否为音频模式
let speakers: string[] = ['说话人A', '说话人B', '说话人C'];
let currentSegmentIndex: number = 0;
let showOriginalText: boolean = false;
let audioBuffer: AudioBuffer | null = null;
let audioContext: AudioContext | null = null;
let audioSource: AudioBufferSourceNode | null = null;
let isPlaying: boolean = false;
let playbackStartTime: number = 0;
let pausedAt: number = 0;
let roles: Array<{id: string, name: string, color: string}> = [
    {id: 'role-a', name: 'Role A', color: '#4caf50'},
    {id: 'role-b', name: 'Role B', color: '#2196f3'}
];

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
    importBtn: document.getElementById('importBtn') as HTMLButtonElement,
    importAudioBtn: document.getElementById('importAudioBtn') as HTMLButtonElement,
    exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
    
    /** 设置 */
    settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
    settingsModal: document.getElementById('settingsModal') as HTMLDivElement,
    whisperModelPath: document.getElementById('whisperModelPath') as HTMLInputElement,
    sakuraModelPath: document.getElementById('sakuraModelPath') as HTMLInputElement,
    sakuraGpuLayers: document.getElementById('sakuraGpuLayers') as HTMLSelectElement,
    outputDirectory: document.getElementById('outputDirectory') as HTMLInputElement,
    defaultSourceLanguage: document.getElementById('defaultSourceLanguage') as HTMLSelectElement,
    defaultTargetLanguage: document.getElementById('defaultTargetLanguage') as HTMLSelectElement,
    
    /** 添加说话人对话框 */
    addSpeakerModal: document.getElementById('addSpeakerModal') as HTMLDivElement,
    speakerNameInput: document.getElementById('speakerNameInput') as HTMLInputElement,
    
    /** 工作区切换 */
    editModeBtn: document.getElementById('editModeBtn') as HTMLButtonElement,
    overviewModeBtn: document.getElementById('overviewModeBtn') as HTMLButtonElement,
    editModeContainer: document.getElementById('editModeContainer') as HTMLDivElement,
    overviewModeContainer: document.getElementById('overviewModeContainer') as HTMLDivElement,
    overviewTableBody: document.getElementById('overviewTableBody') as HTMLTableSectionElement,
    speakerFilter: document.getElementById('speakerFilter') as HTMLSelectElement,
    overviewSearchInput: document.getElementById('overviewSearchInput') as HTMLInputElement,
    
    /** 音频播放控制 */
    playPauseBtn: document.getElementById('playPauseBtn') as HTMLButtonElement,
    currentTime: document.getElementById('currentTime') as HTMLSpanElement,
    totalDuration: document.getElementById('totalDuration') as HTMLSpanElement,
    
    /** 文件类型切换 */
    videoModeBtn: document.getElementById('videoModeBtn') as HTMLButtonElement,
    audioModeBtn: document.getElementById('audioModeBtn') as HTMLButtonElement,
    videoFileGroup: document.getElementById('videoFileGroup') as HTMLDivElement,
    audioFileGroup: document.getElementById('audioFileGroup') as HTMLDivElement,
    audioPath: document.getElementById('audioPath') as HTMLInputElement,
    selectAudioBtn: document.getElementById('selectAudioBtn') as HTMLButtonElement,
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
    elements.sakuraModelPath.value = currentConfig.sakuraModelPath || '';
    elements.sakuraGpuLayers.value = String(currentConfig.sakuraGpuLayers ?? -1);
    elements.outputDirectory.value = currentConfig.outputDirectory || '';
    elements.sourceLanguage.value = currentConfig.defaultSourceLanguage;
    elements.targetLanguage.value = currentConfig.defaultTargetLanguage;
    elements.defaultSourceLanguage.value = currentConfig.defaultSourceLanguage;
    elements.defaultTargetLanguage.value = currentConfig.defaultTargetLanguage;
    elements.audioFormat.value = currentConfig.audioFormat;
    
    // 更新 SakuraLLM 状态显示
    updateSakuraStatus();
}

/** 更新 SakuraLLM 状态显示 */
async function updateSakuraStatus() {
    try {
        const status = await ipcRenderer.invoke(IpcChannels.GET_SAKURA_STATUS);
        const statusText = document.getElementById('sakuraStatusText');
        const statusDisplay = document.getElementById('sakuraStatusDisplay');
        
        if (statusText && statusDisplay) {
            if (status.loaded) {
                statusText.textContent = `模型状态: ✓ 已加载 (GPU层: ${status.gpuLayers})`;
                statusDisplay.style.background = '#e8f5e9';
            } else {
                statusText.textContent = '模型状态: ✗ 未加载';
                statusDisplay.style.background = '#ffebee';
            }
        }
    } catch (error) {
        console.error('[Renderer] Failed to get Sakura status:', error);
    }
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
    
    /** 导入音频 */
    elements.importAudioBtn?.addEventListener('click', importAudioForSubtitles);
    console.log('[Renderer] ✓ 已绑定 importAudioBtn 点击事件');
    
    /** 处理按钮 */
    elements.processBtn.addEventListener('click', processVideo);
    console.log('[Renderer] ✓ 已绑定 processBtn 点击事件');
    
    /** 导出按钮 */
    elements.exportBtn.addEventListener('click', exportSubtitles);
    console.log('[Renderer] ✓ 已绑定 exportBtn 点击事件');
    
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
        if (path) elements.whisperModelPath.value = path;
    });
    
    document.getElementById('selectSakuraModelBtn')?.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'GGUF Model', extensions: ['gguf'] },
            { name: 'All Files', extensions: ['*'] }
        ]);
        if (path) elements.sakuraModelPath.value = path;
    });
    
    document.getElementById('selectOutputDirBtn')?.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FOLDER);
        if (path) elements.outputDirectory.value = path;
    });
    
    // SakuraLLM 模型加载按钮
    document.getElementById('loadSakuraModelBtn')?.addEventListener('click', loadSakuraModel);
    
    // 监听处理状态
    ipcRenderer.on(IpcChannels.PROCESSING_STATUS, (_: any, status: any) => {
        updateProcessingStatus(status);
    });
    
    /** 工作区切换 */
    elements.editModeBtn.addEventListener('click', switchToEditMode);
    elements.overviewModeBtn.addEventListener('click', switchToOverviewMode);
    
    /** 总览模式搜索和筛选 */
    elements.overviewSearchInput.addEventListener('input', filterOverviewTable);
    elements.speakerFilter.addEventListener('change', filterOverviewTable);
    
    /** 总览模式显示/隐藏原文 */
    document.getElementById('toggleOriginalInOverview')?.addEventListener('click', toggleOriginalInOverview);
    
    /** 音频播放控制 */
    elements.playPauseBtn?.addEventListener('click', togglePlayPause);
    
    /** 文件类型切换 */
    elements.videoModeBtn?.addEventListener('click', switchToVideoMode);
    elements.audioModeBtn?.addEventListener('click', switchToAudioMode);
    elements.selectAudioBtn?.addEventListener('click', selectAudio);
}

/** 切换到视频模式 */
function switchToVideoMode() {
    isAudioMode = false;
    elements.videoModeBtn?.classList.add('active');
    elements.audioModeBtn?.classList.remove('active');
    elements.videoFileGroup?.classList.remove('hidden');
    elements.audioFileGroup?.classList.add('hidden');
}

/** 切换到音频模式 */
function switchToAudioMode() {
    isAudioMode = true;
    elements.audioModeBtn?.classList.add('active');
    elements.videoModeBtn?.classList.remove('active');
    elements.audioFileGroup?.classList.remove('hidden');
    elements.videoFileGroup?.classList.add('hidden');
}

/** 选择音频文件 */
async function selectAudio() {
    try {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_AUDIO);
        if (path) {
            currentVideoPath = path; // 复用这个变量存储音频路径
            if (elements.audioPath) {
                elements.audioPath.value = path;
                elements.processBtn!.disabled = false;
            }
        }
    } catch (error: any) {
        showError('选择音频失败: ' + error.message);
    }
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
        
        let audioPath: string;
        
        // 1. 提取音频（如果是视频模式）
        if (isAudioMode) {
            // 音频模式：直接使用选择的音频文件
            audioPath = currentVideoPath;
            updateProcessingStatus({
                stage: 'extracting',
                progress: 0,
                message: '使用音频文件...'
            });
        } else {
            // 视频模式：提取音频
            updateProcessingStatus({
                stage: 'extracting',
                progress: 0,
                message: '正在提取音频...'
            });
            
            audioPath = await ipcRenderer.invoke(
                IpcChannels.EXTRACT_AUDIO,
                currentVideoPath
            );
        }
        
        // 保存音频路径供波形显示使用
        currentAudioPath = audioPath;
        console.log('[Renderer] Audio extracted to:', audioPath);
        
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
        
        // 3. 转录音频 - 异步处理，通过事件通知获取结果
        updateProcessingStatus({
            stage: 'transcribing',
            progress: 40,
            message: '正在进行语音识别...（后台处理中，界面保持响应）'
        });
        
        console.log('[Renderer] Requesting transcription...');
        
        // 等待转录完成的 Promise
        const segments = await new Promise<any[]>((resolve, reject) => {
            // 监听转录完成事件
            const completedListener = (_event: any, data: any) => {
                console.log('[Renderer] Transcription event received:', data.success);
                
                if (data.success) {
                    resolve(data.segments);
                } else {
                    reject(new Error(data.error));
                }
                
                // 清理监听器
                ipcRenderer.removeListener('transcribe-completed', completedListener);
                ipcRenderer.removeListener('transcribe-started', startedListener);
            };
            
            // 监听转录开始事件（可选，用于调试）
            const startedListener = (_event: any, data: any) => {
                console.log('[Renderer] Transcription started for:', data.audioPath);
            };
            
            ipcRenderer.on('transcribe-completed', completedListener);
            ipcRenderer.on('transcribe-started', startedListener);
            
            // 发起转录请求（不等待返回）
            ipcRenderer.invoke(
                IpcChannels.TRANSCRIBE_AUDIO,
                audioPath,
                elements.sourceLanguage!.value
            ).catch(reject);
        });
        
        console.log('[Renderer] Transcription completed, got', segments.length, 'segments');
        
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
                elements.targetLanguage!.value,
                { beam_size: 5 }
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
        
        // 加载音频用于波形显示
        if (currentAudioPath) {
            console.log('[Renderer] Loading audio for waveform...');
            await loadAudioForWaveform(currentAudioPath).catch(err => {
                console.error('[Renderer] Failed to load audio for waveform:', err);
            });
        }
        
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
        return;
    }
    
    // 从字幕中提取说话人并添加到角色列表
    extractSpeakersFromSegments();
    
    // 使用新的三段式编辑器
    currentSegmentIndex = 0;
    renderCurrentSegment();
    renderRoles();
    
    // 启用导出按钮
    const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
    if (exportBtn) exportBtn.disabled = false;
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
        
        // 从字幕中提取说话人并添加到角色列表
        extractSpeakersFromSegments();
        
        displaySubtitles();
        elements.exportBtn.disabled = false;
        
        alert(`成功导入 ${currentSegments.length} 条字幕`);
    } catch (error: any) {
        showError('导入字幕失败: ' + error.message);
    }
}

/**
 * 从字幕段中提取说话人并添加到角色列表
 */
function extractSpeakersFromSegments() {
    // 收集所有唯一的说话人
    const speakerSet = new Set<string>();
    currentSegments.forEach(seg => {
        if (seg.speaker && seg.speaker.trim() !== '') {
            speakerSet.add(seg.speaker);
        }
    });
    
    // 为每个新的说话人添加角色（如果还不存在）
    const colors = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#cddc39', '#ff5722'];
    let colorIndex = roles.length % colors.length;
    
    speakerSet.forEach(speaker => {
        // 检查是否已存在
        const exists = roles.some(role => role.name === speaker);
        if (!exists) {
            roles.push({
                id: `role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: speaker,
                color: colors[colorIndex % colors.length]
            });
            colorIndex++;
        }
    });
    
    // 更新角色显示
    renderRoles();
}

/**
 * 导入音频文件（用于已有字幕的情况）
 */
async function importAudioForSubtitles() {
    try {
        // 检查是否已有字幕数据
        if (!currentSegments || currentSegments.length === 0) {
            alert('请先导入字幕文件！');
            return;
        }
        
        // 选择音频文件
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_AUDIO);
        if (!path) return;
        
        // 设置音频路径
        currentAudioPath = path;
        
        // 加载音频到 AudioContext
        try {
            const arrayBuffer = await ipcRenderer.invoke(IpcChannels.READ_AUDIO_BUFFER, path);
            
            if (!audioContext) {
                audioContext = new AudioContext();
            }
            
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // 显示第一个段落的波形
            if (currentSegments.length > 0) {
                drawWaveformForSegment(currentSegments[0]);
            }
            
            // 启用播放按钮
            if (elements.playPauseBtn) {
                elements.playPauseBtn.disabled = false;
            }
            
            // 更新时长显示
            if (elements.totalDuration) {
                elements.totalDuration.textContent = formatTime(audioBuffer.duration);
            }
            
            alert('音频导入成功！现在可以播放和编辑字幕了。');
        } catch (audioError: any) {
            showError('加载音频失败: ' + audioError.message);
        }
    } catch (error: any) {
        showError('导入音频失败: ' + error.message);
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
        
        // 解析时间行
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!timeMatch) continue;
        
        const startTime = Number.parseInt(timeMatch[1]) * 3600 + Number.parseInt(timeMatch[2]) * 60 + 
                         Number.parseInt(timeMatch[3]) + Number.parseInt(timeMatch[4]) / 1000;
        const endTime = Number.parseInt(timeMatch[5]) * 3600 + Number.parseInt(timeMatch[6]) * 60 + 
                       Number.parseInt(timeMatch[7]) + Number.parseInt(timeMatch[8]) / 1000;
        
        // 解析内容行（从第3行开始）
        const contentLines = lines.slice(2);
        let speaker: string | undefined;
        let text = '';
        let translatedText: string | undefined;
        
        // 检查第一行是否是说话人格式 [xxx]
        if (contentLines.length > 0 && contentLines[0].match(/^\[.*\]$/)) {
            const speakerMatch = contentLines[0].match(/^\[(.*)\]$/);
            speaker = speakerMatch && speakerMatch[1] ? speakerMatch[1] : undefined;
            contentLines.shift(); // 移除说话人行
        }
        
        // 剩余的行：第一行是原文，第二行（如果有）是译文
        if (contentLines.length > 0) {
            text = contentLines[0];
        }
        if (contentLines.length > 1) {
            translatedText = contentLines[1];
        }
        
        segments.push({
            id: `seg_${Date.now()}_${segments.length}`,
            startTime,
            endTime,
            text,
            translatedText,
            speaker,
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
    
    // 跳过 WEBVTT 头部
    while (i < lines.length && !lines[i].includes('-->')) {
        i++;
    }
    
    while (i < lines.length) {
        const line = lines[i];
        const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
        
        if (timeMatch) {
            const startTime = Number.parseInt(timeMatch[1]) * 3600 + Number.parseInt(timeMatch[2]) * 60 + 
                             Number.parseInt(timeMatch[3]) + Number.parseInt(timeMatch[4]) / 1000;
            const endTime = Number.parseInt(timeMatch[5]) * 3600 + Number.parseInt(timeMatch[6]) * 60 + 
                           Number.parseInt(timeMatch[7]) + Number.parseInt(timeMatch[8]) / 1000;
            
            i++;
            const contentLines: string[] = [];
            while (i < lines.length && lines[i].trim() !== '') {
                contentLines.push(lines[i]);
                i++;
            }
            
            // 解析内容
            let speaker: string | undefined;
            let text = '';
            let translatedText: string | undefined;
            
            // 检查第一行是否是 VTT 说话人格式 <v xxx> 或 [xxx]
            if (contentLines.length > 0) {
                const vttSpeakerMatch = contentLines[0].match(/^<v\s+([^>]+)>/);
                const srtSpeakerMatch = contentLines[0].match(/^\[(.*)\]$/);
                
                if (vttSpeakerMatch) {
                    speaker = vttSpeakerMatch[1] || undefined;
                    contentLines[0] = contentLines[0].replace(/^<v\s+[^>]+>/, '').trim();
                } else if (srtSpeakerMatch) {
                    speaker = srtSpeakerMatch[1] || undefined;
                    contentLines.shift();
                }
            }
            
            // 剩余的行：第一行是原文，第二行（如果有）是译文
            if (contentLines.length > 0 && contentLines[0]) {
                text = contentLines[0];
            }
            if (contentLines.length > 1) {
                translatedText = contentLines[1];
            }
            
            segments.push({
                id: `seg_${Date.now()}_${segments.length}`,
                startTime,
                endTime,
                text,
                translatedText,
                speaker,
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
            sakuraModelPath: elements.sakuraModelPath.value,
            sakuraGpuLayers: parseInt(elements.sakuraGpuLayers.value, 10),
            outputDirectory: elements.outputDirectory.value,
            defaultSourceLanguage: elements.defaultSourceLanguage.value as 'ja' | 'en',
            defaultTargetLanguage: elements.defaultTargetLanguage.value,
        };
        
        currentConfig = await ipcRenderer.invoke(IpcChannels.UPDATE_CONFIG, updates);
        
        // 更新主界面的语言选项
        elements.sourceLanguage.value = updates.defaultSourceLanguage;
        elements.targetLanguage.value = updates.defaultTargetLanguage;
        
        elements.settingsModal.classList.add('hidden');
        alert('设置已保存\n\n提示：如果修改了 SakuraLLM 模型路径，请点击"加载/重新加载 SakuraLLM 模型"按钮');
    } catch (error: any) {
        showError('保存设置失败: ' + error.message);
    }
}

// 加载 SakuraLLM 模型
async function loadSakuraModel() {
    try {
        const btn = document.getElementById('loadSakuraModelBtn') as HTMLButtonElement;
        const originalText = btn.textContent;
        
        // 显示加载状态
        btn.disabled = true;
        btn.textContent = '⏳ 加载中...';
        
        const modelPath = elements.sakuraModelPath.value;
        const gpuLayers = parseInt(elements.sakuraGpuLayers.value, 10);
        
        if (!modelPath) {
            throw new Error('请先选择 SakuraLLM 模型文件');
        }
        
        console.log('[Renderer] Loading SakuraLLM model...');
        const result = await ipcRenderer.invoke(IpcChannels.LOAD_SAKURA_MODEL, modelPath, gpuLayers);
        
        // 恢复按钮状态
        btn.disabled = false;
        btn.textContent = originalText || '🔄 加载/重新加载 SakuraLLM 模型';
        
        if (result.success) {
            alert('✓ SakuraLLM 模型加载成功！\n\n现在可以使用日译中翻译了。');
            console.log('[Renderer] SakuraLLM model loaded successfully');
            updateSakuraStatus();
        } else {
            showError('加载失败: ' + result.message);
        }
    } catch (error: any) {
        const btn = document.getElementById('loadSakuraModelBtn') as HTMLButtonElement;
        btn.disabled = false;
        btn.textContent = '🔄 加载/重新加载 SakuraLLM 模型';
        showError('加载 SakuraLLM 模型失败: ' + error.message);
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

// ========== 新的三段式编辑器功能 ==========

/** 初始化新编辑器 */
function initNewEditor() {
    console.log('[Editor] Initializing new editor...');
    
    const toggleOriginalBtn = document.getElementById('toggleOriginalBtn');
    const translateCurrentBtn = document.getElementById('translateCurrentBtn') as HTMLButtonElement;
    const prevSegmentBtn = document.getElementById('prevSegmentBtn');
    const nextSegmentBtn = document.getElementById('nextSegmentBtn');
    const addRoleBtn = document.getElementById('addRoleBtn');
    
    console.log('[Editor] Buttons found:', {
        toggleOriginal: !!toggleOriginalBtn,
        translateCurrent: !!translateCurrentBtn,
        prev: !!prevSegmentBtn,
        next: !!nextSegmentBtn,
        addRole: !!addRoleBtn
    });
    
    // 切换原文显示
    if (toggleOriginalBtn) {
        toggleOriginalBtn.addEventListener('click', () => {
            console.log('[Editor] Toggle original text clicked');
            showOriginalText = !showOriginalText;
            renderCurrentSegment();
        });
    }

    // 翻译当前段落
    // 注意：NLLB 模型不支持上下文分割翻译，会把多个句子合并成一个
    // 因此这里直接使用单句翻译，以保证翻译质量
    if (translateCurrentBtn) {
        translateCurrentBtn.addEventListener('click', async () => {
            console.log('[Editor] Translate current segment clicked');
            if (currentSegments.length === 0) return;
            
            const segment = currentSegments[currentSegmentIndex];
            if (!segment || !segment.text) {
                alert('当前段落没有原文可翻译');
                return;
            }
            
            try {
                // 显示加载状态
                const originalIcon = translateCurrentBtn.innerHTML;
                translateCurrentBtn.innerHTML = '<span class="translate-icon">⏳</span>';
                translateCurrentBtn.disabled = true;
                
                // 直接翻译当前段落（NLLB 不支持上下文分割）
                const textToTranslate = segment.text.trim();
                
                console.log('[Editor] Translating:', JSON.stringify(textToTranslate));
                
                const translations = await ipcRenderer.invoke(
                    IpcChannels.BATCH_TRANSLATE,
                    [textToTranslate],
                    elements.sourceLanguage.value,
                    elements.targetLanguage.value,
                    { beam_size: 5 }
                );
                
                if (translations && translations.length > 0) {
                    const finalTranslation = translations[0];
                    console.log('[Editor] Translation result:', finalTranslation);
                    
                    segment.translatedText = finalTranslation.trim();
                    
                    // 更新 UI
                    const textarea = document.getElementById('translatedTextArea') as HTMLTextAreaElement;
                    if (textarea) {
                        textarea.value = segment.translatedText || '';
                    }
                    console.log('[Editor] Translation updated:', segment.translatedText);
                }
                
                // 恢复按钮状态
                translateCurrentBtn.innerHTML = originalIcon;
                translateCurrentBtn.disabled = false;
                
            } catch (error: any) {
                console.error('[Editor] Translation failed:', error);
                alert('翻译失败: ' + error.message);
                translateCurrentBtn.innerHTML = '<span class="translate-icon">🌐</span>';
                translateCurrentBtn.disabled = false;
            }
        });
    }
    
    // 上一段/下一段
    if (prevSegmentBtn) {
        prevSegmentBtn.addEventListener('click', () => {
            console.log('[Editor] Previous segment clicked, current index:', currentSegmentIndex);
            if (currentSegmentIndex > 0) {
                currentSegmentIndex--;
                renderCurrentSegment();
                renderRoles();
            }
        });
    }
    
    if (nextSegmentBtn) {
        nextSegmentBtn.addEventListener('click', () => {
            console.log('[Editor] Next segment clicked, current index:', currentSegmentIndex);
            if (currentSegmentIndex < currentSegments.length - 1) {
                currentSegmentIndex++;
                renderCurrentSegment();
                renderRoles();
            }
        });
    }
    
    // 添加角色
    if (addRoleBtn) {
        addRoleBtn.addEventListener('click', () => {
            console.log('[Editor] Add role clicked');
            openAddRoleModal();
        });
    }
    
    // 添加角色对话框事件
    setupAddRoleModal();
    
    // 初始化角色列表
    renderRoles();
}

/** 设置添加角色对话框 */
function setupAddRoleModal() {
    const modal = document.getElementById('addRoleModal');
    const modalContent = modal?.querySelector('.modal-content');
    const closeBtn = document.getElementById('closeRoleModal');
    const cancelBtn = document.getElementById('cancelAddRole');
    const confirmBtn = document.getElementById('confirmAddRole');
    const roleNameInput = document.getElementById('roleNameInput') as HTMLInputElement;
    
    console.log('[Editor] Setting up add role modal, elements:', {
        modal: !!modal,
        modalContent: !!modalContent,
        closeBtn: !!closeBtn,
        cancelBtn: !!cancelBtn,
        confirmBtn: !!confirmBtn,
        roleNameInput: !!roleNameInput
    });
    
    // 关闭对话框
    const closeModal = () => {
        console.log('[Editor] Closing role modal');
        if (modal) modal.classList.add('hidden');
        if (roleNameInput) roleNameInput.value = '';
    };
    
    // 点击背景关闭（但不关闭内容区）
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            console.log('[Editor] Clicked modal background');
            closeModal();
        }
    });
    
    // 阻止内容区点击事件冒泡
    modalContent?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
    });
    
    cancelBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
    });
    
    // 确认添加
    confirmBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        const name = roleNameInput?.value.trim();
        console.log('[Editor] Confirm clicked, role name:', name);
        if (name) {
            const colors = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4'];
            const color = colors[roles.length % colors.length];
            roles.push({
                id: `role-${Date.now()}`,
                name: name,
                color: color
            });
            console.log('[Editor] Role added:', name, '- Total roles:', roles.length);
            renderRoles();
            closeModal();
        } else {
            alert('请输入角色名称！');
        }
    });
    
    // 回车确认
    roleNameInput?.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            console.log('[Editor] Enter pressed in role input');
            confirmBtn?.click();
        }
    });
    
    // 确保输入框可以获取焦点
    roleNameInput?.addEventListener('focus', () => {
        console.log('[Editor] Role input focused');
    });
}

/** 打开添加角色对话框 */
function openAddRoleModal() {
    const modal = document.getElementById('addRoleModal');
    const roleNameInput = document.getElementById('roleNameInput') as HTMLInputElement;
    
    if (modal) {
        modal.classList.remove('hidden');
        // 延迟聚焦，确保对话框完全显示
        setTimeout(() => {
            roleNameInput?.focus();
        }, 100);
    }
}

/** 渲染当前字幕段 */
function renderCurrentSegment() {
    const container = document.getElementById('textEditorContent');
    const segmentCounter = document.getElementById('segmentCounter');
    const prevBtn = document.getElementById('prevSegmentBtn') as HTMLButtonElement;
    const nextBtn = document.getElementById('nextSegmentBtn') as HTMLButtonElement;
    
    // 停止当前播放
    if (isPlaying) {
        stopAudio();
    }
    
    if (!container || currentSegments.length === 0) {
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无字幕数据</p>
                    <p class="hint">选择视频并点击"开始处理"生成字幕</p>
                </div>
            `;
        }
        return;
    }
    
    const segment = currentSegments[currentSegmentIndex];
    
    // 更新计数器
    if (segmentCounter) {
        segmentCounter.textContent = `${currentSegmentIndex + 1} / ${currentSegments.length}`;
    }
    
    // 更新按钮状态
    if (prevBtn) prevBtn.disabled = currentSegmentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentSegmentIndex === currentSegments.length - 1;
    
    // 渲染编辑器
    container.innerHTML = `
        <div class="segment-editor">
            <div class="segment-time-info">
                <span class="time-badge">${formatTime(segment.startTime)} → ${formatTime(segment.endTime)}</span>
                <span>段落 ${currentSegmentIndex + 1}</span>
            </div>
            
            <div class="text-field">
                <label class="text-field-label">译文</label>
                <textarea id="translatedTextArea" rows="4">${segment.translatedText || segment.text}</textarea>
            </div>
            
            ${showOriginalText ? `
                <div class="original-text">
                    <div class="original-text-label">原文</div>
                    <div class="original-text-content">${segment.text}</div>
                </div>
            ` : ''}
        </div>
    `;
    
    // 监听文本变化
    const textarea = document.getElementById('translatedTextArea') as HTMLTextAreaElement;
    if (textarea) {
        textarea.addEventListener('input', (e) => {
            const target = e.target as HTMLTextAreaElement;
            currentSegments[currentSegmentIndex].translatedText = target.value;
        });
    }
    
    // 绘制波形（如果有音频）
    drawWaveformForSegment(segment);
}

/** 渲染角色列表 */
function renderRoles() {
    const roleList = document.getElementById('roleList');
    if (!roleList) return;
    
    if (roles.length === 0) {
        roleList.innerHTML = `
            <div class="empty-role-state">
                点击右上角 ➕ 按钮添加角色
            </div>
        `;
        return;
    }
    
    roleList.innerHTML = roles.map((role, index) => `
        <div class="role-item ${currentSegments[currentSegmentIndex]?.speaker === role.name ? 'active' : ''}" 
             data-role-id="${role.id}">
            <span class="role-color-indicator" style="background-color: ${role.color}"></span>
            <span class="role-name">${role.name}</span>
            ${index >= 2 ? '<button class="role-delete-btn" data-role-id="' + role.id + '">×</button>' : ''}
        </div>
    `).join('');
    
    // 绑定角色点击事件
    roleList.querySelectorAll('.role-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('role-delete-btn')) {
                const roleId = target.dataset.roleId;
                roles = roles.filter(r => r.id !== roleId);
                renderRoles();
                return;
            }
            
            const roleId = (item as HTMLElement).dataset.roleId;
            const role = roles.find(r => r.id === roleId);
            if (role && currentSegments[currentSegmentIndex]) {
                currentSegments[currentSegmentIndex].speaker = role.name;
                renderRoles();
            }
        });
    });
}

/** 绘制波形 */
function drawWaveformForSegment(segment: TranscriptSegment) {
    const canvas = document.getElementById('waveformCanvas') as HTMLCanvasElement;
    const placeholder = document.getElementById('waveformPlaceholder');
    
    if (!canvas || !audioBuffer) {
        if (placeholder) placeholder.style.display = 'flex';
        return;
    }
    
    if (placeholder) placeholder.style.display = 'none';
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置 canvas 尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    
    // 清空画布
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // 获取音频数据
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(segment.startTime * sampleRate);
    const endSample = Math.floor(segment.endTime * sampleRate);
    const segmentSamples = endSample - startSample;
    
    // 计算每个像素代表的样本数
    const samplesPerPixel = Math.max(1, Math.floor(segmentSamples / width));
    
    // 绘制波形
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
        const sampleIndex = startSample + x * samplesPerPixel;
        if (sampleIndex >= channelData.length) break;
        
        // 获取该像素范围内的最大振幅
        let max = 0;
        for (let i = 0; i < samplesPerPixel; i++) {
            const index = sampleIndex + i;
            if (index < channelData.length) {
                max = Math.max(max, Math.abs(channelData[index]));
            }
        }
        
        const y = (height / 2) + (max * height / 2) * (x % 2 === 0 ? -1 : 1);
        
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
}

/** 加载音频到缓冲区 */
async function loadAudioForWaveform(audioPath: string) {
    try {
        console.log('[Waveform] Loading audio from:', audioPath);
        
        if (!audioContext) {
            audioContext = new AudioContext();
            console.log('[Waveform] AudioContext created');
        }
        
        // 使用Node.js fs读取文件
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(audioPath);
        const arrayBuffer = fileBuffer.buffer.slice(
            fileBuffer.byteOffset,
            fileBuffer.byteOffset + fileBuffer.byteLength
        );
        
        console.log('[Waveform] File read, size:', arrayBuffer.byteLength);
        
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        console.log('[Waveform] Audio decoded successfully, duration:', audioBuffer.duration);
        
        // 启用播放按钮并更新时长
        if (elements.playPauseBtn) {
            elements.playPauseBtn.disabled = false;
        }
        
        // 显示当前段落的时长
        if (elements.totalDuration && currentSegments.length > 0) {
            const segment = currentSegments[currentSegmentIndex];
            elements.totalDuration.textContent = formatTime(segment.endTime - segment.startTime);
        }
        
        // 立即绘制当前段落的波形
        if (currentSegments.length > 0) {
            drawWaveformForSegment(currentSegments[currentSegmentIndex]);
        }
    } catch (error) {
        console.error('[Waveform] Failed to load audio:', error);
    }
}

// ==================== 音频播放控制 ====================

/** 切换播放/暂停 */
function togglePlayPause() {
    if (!audioBuffer || !audioContext) {
        console.warn('[Audio] No audio loaded');
        return;
    }
    
    if (isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
}

/** 播放音频 */
function playAudio() {
    if (!audioBuffer || !audioContext) return;
    
    const segment = currentSegments[currentSegmentIndex];
    if (!segment) return;
    
    // 停止之前的播放
    if (audioSource) {
        audioSource.stop();
        audioSource = null;
    }
    
    // 创建新的音频源
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioContext.destination);
    
    // 计算播放的起始位置和持续时间
    const startTime = segment.startTime;
    const endTime = segment.endTime;
    const duration = endTime - startTime;
    
    // 如果有暂停位置且在当前段落范围内，从暂停位置继续
    let startOffset = startTime;
    let playDuration = duration;
    
    if (pausedAt > 0 && pausedAt >= startTime && pausedAt < endTime) {
        startOffset = pausedAt;
        playDuration = endTime - pausedAt;
    }
    
    // 开始播放，只播放当前段落的时间范围
    audioSource.start(0, startOffset, playDuration);
    playbackStartTime = audioContext.currentTime - startOffset;
    isPlaying = true;
    
    // 更新按钮
    if (elements.playPauseBtn) {
        elements.playPauseBtn.textContent = '⏸️';
    }
    
    // 监听播放结束
    audioSource.onended = () => {
        if (isPlaying) {
            stopAudio();
        }
    };
    
    // 开始更新时间显示
    updatePlaybackTime();
    
    console.log('[Audio] Playing segment from:', startOffset, 'to:', endTime, '(duration:', playDuration, ')');
}

/** 暂停音频 */
function pauseAudio() {
    if (!audioContext || !audioSource) return;
    
    audioSource.stop();
    audioSource = null;
    
    pausedAt = audioContext.currentTime - playbackStartTime;
    isPlaying = false;
    
    // 更新按钮
    if (elements.playPauseBtn) {
        elements.playPauseBtn.textContent = '▶️';
    }
    
    console.log('[Audio] Paused at:', pausedAt);
}

/** 停止音频 */
function stopAudio() {
    if (audioSource) {
        try {
            audioSource.stop();
        } catch (e) {
            // 可能已经停止了
        }
        audioSource = null;
    }
    
    isPlaying = false;
    pausedAt = 0;
    
    // 更新按钮和时间
    if (elements.playPauseBtn) {
        elements.playPauseBtn.textContent = '▶️';
    }
    if (elements.currentTime) {
        elements.currentTime.textContent = '0:00';
    }
    
    // 更新段落总时长
    const segment = currentSegments[currentSegmentIndex];
    if (segment && elements.totalDuration) {
        elements.totalDuration.textContent = formatTime(segment.endTime - segment.startTime);
    }
    
    console.log('[Audio] Stopped');
}

/** 更新播放时间显示 */
function updatePlaybackTime() {
    if (!isPlaying || !audioContext) return;
    
    const segment = currentSegments[currentSegmentIndex];
    if (!segment) return;
    
    const currentPlayTime = audioContext.currentTime - playbackStartTime;
    
    // 计算相对于段落开始的时间
    const segmentTime = currentPlayTime - segment.startTime;
    
    if (elements.currentTime) {
        // 显示段落内的相对时间
        elements.currentTime.textContent = formatTime(Math.max(0, segmentTime));
    }
    
    // 显示段落总时长
    if (elements.totalDuration) {
        elements.totalDuration.textContent = formatTime(segment.endTime - segment.startTime);
    }
    
    // 继续更新
    if (isPlaying) {
        requestAnimationFrame(updatePlaybackTime);
    }
}

// ==================== 工作区切换 ====================

/** 切换到编辑模式 */
function switchToEditMode() {
    elements.editModeBtn.classList.add('active');
    elements.overviewModeBtn.classList.remove('active');
    elements.editModeContainer.classList.remove('hidden');
    elements.overviewModeContainer.classList.add('hidden');
}

/** 切换到总览模式 */
function switchToOverviewMode() {
    elements.editModeBtn.classList.remove('active');
    elements.overviewModeBtn.classList.add('active');
    elements.editModeContainer.classList.add('hidden');
    elements.overviewModeContainer.classList.remove('hidden');
    
    // 渲染总览表格
    renderOverviewTable();
}

/** 渲染总览表格 */
function renderOverviewTable() {
    if (currentSegments.length === 0) {
        elements.overviewTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4">
                    <div class="empty-state">
                        <p>暂无字幕数据</p>
                        <p class="hint">选择视频并点击"开始处理"生成字幕</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // 更新说话人筛选器
    updateSpeakerFilter();
    
    // 检查原文列是否显示
    const isOriginalVisible = !document.querySelector('.overview-table .col-original')?.classList.contains('hidden');
    
    // 生成表格行
    const rows = currentSegments.map((seg, index) => {
        const timeStr = formatTimestamp(seg.startTime);
        const speaker = seg.speaker || '';
        const original = seg.text || '';
        const translation = seg.translatedText || '';
        
        // 获取说话人颜色
        const role = roles.find(r => r.name === speaker);
        const speakerBadge = speaker ? 
            `<span class="speaker-badge" style="background: ${role?.color || '#666'}; color: white;">${speaker}</span>` : 
            '';
        
        return `
            <tr data-index="${index}" onclick="selectSegmentFromOverview(${index})">
                <td class="col-time">${timeStr}</td>
                <td class="col-speaker">${speakerBadge}</td>
                <td class="col-original ${isOriginalVisible ? '' : 'hidden'}">${escapeHtml(original)}</td>
                <td class="col-translation">${escapeHtml(translation)}</td>
            </tr>
        `;
    }).join('');
    
    elements.overviewTableBody.innerHTML = rows;
}

/** 切换总览模式中的原文显示 */
function toggleOriginalInOverview() {
    const btn = document.getElementById('toggleOriginalInOverview');
    const headerCol = document.querySelector('.overview-table .col-original');
    const dataCols = document.querySelectorAll('.overview-table tbody .col-original');
    
    if (headerCol?.classList.contains('hidden')) {
        // 显示原文
        headerCol.classList.remove('hidden');
        dataCols.forEach(col => col.classList.remove('hidden'));
        if (btn) btn.textContent = '👁️ 隐藏原文';
    } else {
        // 隐藏原文
        headerCol?.classList.add('hidden');
        dataCols.forEach(col => col.classList.add('hidden'));
        if (btn) btn.textContent = '👁️ 显示原文';
    }
}

/** 更新说话人筛选器 */
function updateSpeakerFilter() {
    const uniqueSpeakers = Array.from(new Set(
        currentSegments
            .map(seg => seg.speaker)
            .filter(s => s && s.trim() !== '')
    )) as string[];
    
    const options = [
        '<option value="">全部说话人</option>',
        ...uniqueSpeakers.map(speaker => 
            `<option value="${escapeHtml(speaker!)}">${escapeHtml(speaker!)}</option>`
        )
    ].join('');
    
    elements.speakerFilter.innerHTML = options;
}

/** 筛选总览表格 */
function filterOverviewTable() {
    const searchText = elements.overviewSearchInput.value.toLowerCase();
    const selectedSpeaker = elements.speakerFilter.value;
    
    const rows = elements.overviewTableBody.querySelectorAll('tr:not(.empty-row)');
    
    rows.forEach((row) => {
        const index = parseInt(row.getAttribute('data-index') || '0');
        const seg = currentSegments[index];
        
        // 检查搜索文本
        const matchesSearch = !searchText || 
            seg.text.toLowerCase().includes(searchText) ||
            (seg.translatedText && seg.translatedText.toLowerCase().includes(searchText));
        
        // 检查说话人筛选
        const matchesSpeaker = !selectedSpeaker || seg.speaker === selectedSpeaker;
        
        // 显示/隐藏行
        if (matchesSearch && matchesSpeaker) {
            (row as HTMLElement).style.display = '';
        } else {
            (row as HTMLElement).style.display = 'none';
        }
    });
}

/** 从总览表格选择段落 */
(window as any).selectSegmentFromOverview = function(index: number) {
    currentSegmentIndex = index;
    switchToEditMode();
    renderCurrentSegment();
};

/** 格式化时间戳 */
function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** HTML 转义 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('[Renderer] ========== 脚本加载完成 ==========');
console.log('[Renderer] 即将调用 init() 函数');
// 启动应用
init().then(() => {
    initNewEditor();
}).catch((error) => {
    console.error('[Renderer] init() 执行出错:', error);
});
