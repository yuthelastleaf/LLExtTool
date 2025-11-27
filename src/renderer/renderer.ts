/**
 * 渲染器主入口
 * 整合所有模块功能
 */

// 导入模块
import { state, initElements, getElements } from './modules/state';
import { loadConfig, saveSettings, loadSakuraModel } from './modules/config';
import { parseSRT, parseVTT, parseASS } from './modules/subtitle-parser';
import { togglePlayPause, loadAudioForWaveform } from './modules/audio';
import { initNewEditor, renderCurrentSegment, renderRoles, extractSpeakersFromSegments } from './modules/editor';
import { switchToEditMode, switchToOverviewMode, filterOverviewTable, toggleOriginalInOverview } from './modules/overview';
import { initFinetuneEditor } from './modules/finetune';
import { formatDuration, showError, ipcRenderer, IpcChannels } from './modules/utils';

/** 初始化 */
async function init() {
    console.log('[Renderer] ========== 开始初始化 ==========');
    
    // 初始化 DOM 元素
    initElements();
    await loadConfig();
    setupEventListeners();
    
    // 初始化微调编辑器
    initFinetuneEditor();
    
    console.log('[Renderer] ========== 初始化完成 ==========');
}

/** 设置事件监听 */
function setupEventListeners() {
    const elements = getElements();
    console.log('[Renderer] 开始设置事件监听器...');
    
    // 视频选择
    elements.selectVideoBtn.addEventListener('click', selectVideo);
    
    // 导入字幕
    elements.importBtn.addEventListener('click', importSubtitles);
    
    // 导入音频
    elements.importAudioBtn?.addEventListener('click', importAudioForSubtitles);
    
    // 处理按钮
    elements.processBtn.addEventListener('click', processVideo);
    
    // 导出按钮
    elements.exportBtn.addEventListener('click', exportSubtitles);
    
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
    
    // 添加说话人对话框
    setupSpeakerModal();
    
    // 模型路径选择
    setupModelPathSelectors();
    
    // SakuraLLM 模型加载按钮
    document.getElementById('loadSakuraModelBtn')?.addEventListener('click', loadSakuraModel);
    
    // 监听处理状态
    ipcRenderer.on(IpcChannels.PROCESSING_STATUS, (_: any, status: any) => {
        updateProcessingStatus(status);
    });
    
    // 工作区切换
    elements.editModeBtn.addEventListener('click', switchToEditMode);
    elements.overviewModeBtn.addEventListener('click', switchToOverviewMode);
    
    // 总览模式搜索和筛选
    elements.overviewSearchInput.addEventListener('input', filterOverviewTable);
    elements.speakerFilter.addEventListener('change', filterOverviewTable);
    
    // 总览模式显示/隐藏原文
    document.getElementById('toggleOriginalInOverview')?.addEventListener('click', toggleOriginalInOverview);
    
    // 音频播放控制
    elements.playPauseBtn?.addEventListener('click', togglePlayPause);
    
    // 文件类型切换
    elements.videoModeBtn?.addEventListener('click', switchToVideoMode);
    elements.audioModeBtn?.addEventListener('click', switchToAudioMode);
    elements.batchModeBtn?.addEventListener('click', switchToBatchMode);
    elements.selectAudioBtn?.addEventListener('click', selectAudio);
    elements.selectBatchDirBtn?.addEventListener('click', selectBatchDir);
}

/** 设置说话人对话框 */
function setupSpeakerModal() {
    const elements = getElements();
    
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
        if (name && !state.speakers.includes(name)) {
            state.speakers.push(name);
            displaySubtitles();
            elements.addSpeakerModal.classList.add('hidden');
            elements.speakerNameInput.value = '';
        } else if (state.speakers.includes(name)) {
            alert('该说话人已存在！');
        } else {
            alert('请输入说话人名称！');
        }
    });
    
    elements.speakerNameInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            document.getElementById('confirmAddSpeaker')?.click();
        }
    });
}

/** 设置模型路径选择按钮 */
function setupModelPathSelectors() {
    const elements = getElements();
    
    document.getElementById('selectWhisperModelBtn')?.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'Model Files', extensions: ['bin'] }
        ]);
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
}

// ==================== 文件模式切换 ====================

/** 切换到视频模式 */
function switchToVideoMode() {
    const elements = getElements();
    state.isAudioMode = false;
    state.isBatchMode = false;
    elements.videoModeBtn?.classList.add('active');
    elements.audioModeBtn?.classList.remove('active');
    elements.batchModeBtn?.classList.remove('active');
    elements.videoFileGroup?.classList.remove('hidden');
    elements.audioFileGroup?.classList.add('hidden');
    elements.batchDirGroup?.classList.add('hidden');
}

/** 切换到音频模式 */
function switchToAudioMode() {
    const elements = getElements();
    state.isAudioMode = true;
    state.isBatchMode = false;
    elements.audioModeBtn?.classList.add('active');
    elements.videoModeBtn?.classList.remove('active');
    elements.batchModeBtn?.classList.remove('active');
    elements.audioFileGroup?.classList.remove('hidden');
    elements.videoFileGroup?.classList.add('hidden');
    elements.batchDirGroup?.classList.add('hidden');
}

/** 切换到批量处理模式 */
function switchToBatchMode() {
    const elements = getElements();
    state.isAudioMode = false;
    state.isBatchMode = true;
    elements.batchModeBtn?.classList.add('active');
    elements.videoModeBtn?.classList.remove('active');
    elements.audioModeBtn?.classList.remove('active');
    elements.batchDirGroup?.classList.remove('hidden');
    elements.videoFileGroup?.classList.add('hidden');
    elements.audioFileGroup?.classList.add('hidden');
}

/** 选择批量处理目录 */
async function selectBatchDir() {
    const elements = getElements();
    try {
        const dirPath = await ipcRenderer.invoke(IpcChannels.SELECT_FOLDER);
        if (dirPath) {
            state.batchDirPath = dirPath;
            elements.batchDirPath.value = dirPath;
            
            // 获取目录中的视频文件列表
            const videoFiles = await ipcRenderer.invoke(IpcChannels.LIST_VIDEO_FILES, dirPath) as string[];
            state.batchFiles = videoFiles;
            
            if (videoFiles.length > 0) {
                elements.batchFileCount.textContent = `找到 ${videoFiles.length} 个视频文件`;
                elements.processBtn.disabled = false;
            } else {
                elements.batchFileCount.textContent = '目录中没有视频文件';
                elements.processBtn.disabled = true;
            }
        }
    } catch (error: any) {
        showError('选择目录失败: ' + error.message);
    }
}

/** 选择音频文件 */
async function selectAudio() {
    const elements = getElements();
    try {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_AUDIO);
        if (path) {
            state.currentVideoPath = path;
            if (elements.audioPath) {
                elements.audioPath.value = path;
                elements.processBtn.disabled = false;
            }
        }
    } catch (error: any) {
        showError('选择音频失败: ' + error.message);
    }
}

/** 选择视频 */
async function selectVideo() {
    const elements = getElements();
    try {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_VIDEO);
        if (path) {
            state.currentVideoPath = path;
            elements.videoPath.value = path;
            elements.processBtn.disabled = false;
            
            const info = await ipcRenderer.invoke(IpcChannels.GET_VIDEO_INFO, path);
            displayVideoInfo(info);
        }
    } catch (error: any) {
        showError('选择视频失败: ' + error.message);
    }
}

/** 显示视频信息 */
function displayVideoInfo(info: any) {
    const elements = getElements();
    const duration = formatDuration(info.duration);
    elements.videoInfo.innerHTML = `
        <p><strong>时长:</strong> ${duration}</p>
        <p><strong>分辨率:</strong> ${info.width} x ${info.height}</p>
        <p><strong>帧率:</strong> ${info.fps.toFixed(2)} fps</p>
        <p><strong>音频:</strong> ${info.hasAudio ? '有' : '无'}</p>
    `;
}

// ==================== 处理视频 ====================

/** 处理视频（支持单文件和批量处理） */
async function processVideo() {
    // 批量处理模式
    if (state.isBatchMode) {
        await processBatchVideos();
        return;
    }
    
    // 单文件处理
    if (!state.currentVideoPath) return;
    await processSingleVideo(state.currentVideoPath);
}

/** 批量处理目录中的视频 */
async function processBatchVideos() {
    const elements = getElements();
    
    if (!state.batchFiles || state.batchFiles.length === 0) {
        showError('没有找到视频文件');
        return;
    }
    
    elements.processBtn.disabled = true;
    elements.statusPanel.classList.remove('hidden');
    
    const total = state.batchFiles.length;
    let processed = 0;
    let failed = 0;
    
    for (const videoPath of state.batchFiles) {
        const fileName = videoPath.split(/[/\\]/).pop() || videoPath;
        updateProcessingStatus({
            stage: 'extracting',
            progress: (processed / total) * 100,
            message: `[${processed + 1}/${total}] 正在处理: ${fileName}`
        });
        
        try {
            await processSingleVideoAndExport(videoPath);
            processed++;
        } catch (error: any) {
            console.error(`处理 ${fileName} 失败:`, error);
            failed++;
            processed++;
        }
    }
    
    // 完成
    const successCount = total - failed;
    updateProcessingStatus({
        stage: 'completed',
        progress: 100,
        message: `批量处理完成！成功 ${successCount}/${total}${failed > 0 ? `，失败 ${failed}` : ''}`
    });
    
    elements.processBtn.disabled = false;
}

/** 处理单个视频并自动导出 (用于批量处理) */
async function processSingleVideoAndExport(videoPath: string) {
    const elements = getElements();
    
    if (!state.currentConfig?.whisperModelPath) {
        throw new Error('请先在设置中配置 Whisper 模型路径');
    }
    
    // 提取音频
    const audioPath = await ipcRenderer.invoke(IpcChannels.EXTRACT_AUDIO, videoPath);
    
    // 加载模型（如果未加载）
    await ipcRenderer.invoke(IpcChannels.LOAD_WHISPER_MODEL, state.currentConfig.whisperModelPath);
    
    // 转录
    const segments = await new Promise<any[]>((resolve, reject) => {
        const completedListener = (_event: any, data: any) => {
            if (data.success) {
                resolve(data.segments);
            } else {
                reject(new Error(data.error));
            }
            ipcRenderer.removeListener('transcribe-completed', completedListener);
        };
        
        ipcRenderer.on('transcribe-completed', completedListener);
        ipcRenderer.invoke(IpcChannels.TRANSCRIBE_AUDIO, audioPath, elements.sourceLanguage.value).catch(reject);
    });
    
    // 翻译
    let translations: string[];
    try {
        const texts = segments.map((seg: any) => seg.text);
        translations = await ipcRenderer.invoke(
            IpcChannels.BATCH_TRANSLATE,
            texts,
            elements.sourceLanguage.value,
            elements.targetLanguage.value,
            { beam_size: 5 }
        );
    } catch {
        translations = segments.map((seg: any) => seg.text);
    }
    
    // 合并结果
    const processedSegments = segments.map((seg: any, index: number) => ({
        ...seg,
        translatedText: translations[index]
    }));
    
    // 自动导出 - 与原视频同目录，同名 .json
    const outputPath = videoPath.replace(/\.[^.]+$/, '.json');
    
    await ipcRenderer.invoke(IpcChannels.WRITE_FILE, outputPath, JSON.stringify(processedSegments, null, 2));
    console.log(`[Batch] 导出完成: ${outputPath}`);
}

/** 处理单个视频（界面显示） */
async function processSingleVideo(videoPath: string) {
    const elements = getElements();
    
    elements.processBtn.disabled = true;
    elements.statusPanel.classList.remove('hidden');
    
    try {
        if (!state.currentConfig?.whisperModelPath) {
            throw new Error('请先在设置中配置 Whisper 模型路径');
        }
        
        let audioPath: string;
        
        if (state.isAudioMode) {
            audioPath = videoPath;
            updateProcessingStatus({ stage: 'extracting', progress: 0, message: '使用音频文件...' });
        } else {
            updateProcessingStatus({ stage: 'extracting', progress: 0, message: '正在提取音频...' });
            audioPath = await ipcRenderer.invoke(IpcChannels.EXTRACT_AUDIO, videoPath);
        }
        
        state.currentAudioPath = audioPath;
        
        // 加载模型
        updateProcessingStatus({ stage: 'transcribing', progress: 30, message: '正在加载 Whisper 模型...' });
        await ipcRenderer.invoke(IpcChannels.LOAD_WHISPER_MODEL, state.currentConfig.whisperModelPath);
        
        // 转录
        updateProcessingStatus({ stage: 'transcribing', progress: 40, message: '正在进行语音识别...' });
        
        const segments = await new Promise<any[]>((resolve, reject) => {
            const completedListener = (_event: any, data: any) => {
                if (data.success) {
                    resolve(data.segments);
                } else {
                    reject(new Error(data.error));
                }
                ipcRenderer.removeListener('transcribe-completed', completedListener);
            };
            
            ipcRenderer.on('transcribe-completed', completedListener);
            ipcRenderer.invoke(IpcChannels.TRANSCRIBE_AUDIO, audioPath, elements.sourceLanguage.value).catch(reject);
        });
        
        // 翻译
        updateProcessingStatus({ stage: 'translating', progress: 70, message: '正在翻译字幕...' });
        
        let translations: string[];
        try {
            const texts = segments.map((seg: any) => seg.text);
            translations = await ipcRenderer.invoke(
                IpcChannels.BATCH_TRANSLATE,
                texts,
                elements.sourceLanguage.value,
                elements.targetLanguage.value,
                { beam_size: 5 }
            );
        } catch {
            translations = segments.map((seg: any) => seg.text);
        }
        
        // 合并结果
        state.currentSegments = segments.map((seg: any, index: number) => ({
            ...seg,
            translatedText: translations[index]
        }));
        
        // 完成
        updateProcessingStatus({ stage: 'completed', progress: 100, message: '处理完成！' });
        
        displaySubtitles();
        elements.exportBtn.disabled = false;
        
        if (state.currentAudioPath) {
            await loadAudioForWaveform(state.currentAudioPath).catch(console.error);
        }
        
    } catch (error: any) {
        updateProcessingStatus({ stage: 'error', progress: 0, message: '处理失败: ' + error.message });
        showError('处理失败: ' + error.message);
    } finally {
        elements.processBtn.disabled = false;
    }
}

/** 更新处理状态 */
function updateProcessingStatus(status: any) {
    const elements = getElements();
    const messageEl = elements.statusPanel.querySelector('.status-message') as HTMLElement;
    const fillEl = elements.statusPanel.querySelector('.progress-fill') as HTMLElement;
    const percentageEl = elements.statusPanel.querySelector('.status-percentage') as HTMLElement;
    
    if (messageEl) messageEl.textContent = status.message;
    if (fillEl) fillEl.style.width = status.progress + '%';
    if (percentageEl) percentageEl.textContent = Math.round(status.progress) + '%';
}

// ==================== 字幕显示和导入导出 ====================

/** 显示字幕列表 */
function displaySubtitles() {
    if (state.currentSegments.length === 0) return;
    
    extractSpeakersFromSegments();
    state.currentSegmentIndex = 0;
    renderCurrentSegment();
    renderRoles();
    
    const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
    if (exportBtn) exportBtn.disabled = false;
}

/** 导入字幕 */
async function importSubtitles() {
    const elements = getElements();
    try {
        const filePath = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'Subtitle Files', extensions: ['srt', 'vtt', 'json', 'ass', 'ssa'] }
        ]);
        
        if (!filePath) return;
        
        const content = await ipcRenderer.invoke(IpcChannels.READ_FILE, filePath);
        const lowerPath = filePath.toLowerCase();
        
        if (lowerPath.endsWith('.json')) {
            state.currentSegments = JSON.parse(content);
        } else if (lowerPath.endsWith('.srt')) {
            state.currentSegments = parseSRT(content);
        } else if (lowerPath.endsWith('.vtt')) {
            state.currentSegments = parseVTT(content);
        } else if (lowerPath.endsWith('.ass') || lowerPath.endsWith('.ssa')) {
            state.currentSegments = parseASS(content);
        }
        
        extractSpeakersFromSegments();
        displaySubtitles();
        elements.exportBtn.disabled = false;
        
        // 自动查找并关联同名音频文件
        const associatedAudio = await ipcRenderer.invoke(IpcChannels.FIND_ASSOCIATED_AUDIO, filePath);
        if (associatedAudio) {
            state.currentAudioPath = associatedAudio;
            await loadAudioForWaveform(associatedAudio).catch(console.error);
            if (elements.playPauseBtn) elements.playPauseBtn.disabled = false;
            alert(`成功导入 ${state.currentSegments.length} 条字幕，并自动关联音频文件`);
        } else {
            alert(`成功导入 ${state.currentSegments.length} 条字幕`);
        }
    } catch (error: any) {
        showError('导入字幕失败: ' + error.message);
    }
}

/** 导入音频文件 */
async function importAudioForSubtitles() {
    const elements = getElements();
    try {
        if (!state.currentSegments || state.currentSegments.length === 0) {
            alert('请先导入字幕文件！');
            return;
        }
        
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_AUDIO);
        if (!path) return;
        
        state.currentAudioPath = path;
        
        await loadAudioForWaveform(path);
        
        if (elements.playPauseBtn) elements.playPauseBtn.disabled = false;
        
        alert('音频导入成功！');
    } catch (error: any) {
        showError('导入音频失败: ' + error.message);
    }
}

/** 导出字幕 */
async function exportSubtitles() {
    if (state.currentSegments.length === 0) return;
    
    try {
        const options = {
            format: 'srt',
            includeOriginal: true,
            includeTranslation: true,
            includeSpeaker: true
        };
        
        const path = await ipcRenderer.invoke(IpcChannels.SAVE_SUBTITLES, state.currentSegments, options);
        
        if (path) {
            alert('字幕导出成功: ' + path);
        }
    } catch (error: any) {
        showError('导出失败: ' + error.message);
    }
}

// ==================== 启动应用 ====================

console.log('[Renderer] ========== 脚本加载完成 ==========');

// 启动应用
init()
    .then(() => initNewEditor())
    .catch((error) => console.error('[Renderer] init() 执行出错:', error));
