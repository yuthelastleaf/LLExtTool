/**
 * 配置管理模块
 */

import { state, getElements } from './state';
import { ipcRenderer, IpcChannels, showError } from './utils';

/** 加载配置 */
export async function loadConfig() {
    try {
        state.currentConfig = await ipcRenderer.invoke(IpcChannels.GET_CONFIG);
        updateConfigUI();
    } catch (error: any) {
        showError('加载配置失败: ' + error.message);
    }
}

/** 更新配置 UI */
export function updateConfigUI() {
    if (!state.currentConfig) return;
    
    const elements = getElements();
    
    elements.whisperModelPath.value = state.currentConfig.whisperModelPath || '';
    elements.sakuraModelPath.value = state.currentConfig.sakuraModelPath || '';
    elements.sakuraGpuLayers.value = String(state.currentConfig.sakuraGpuLayers ?? -1);
    elements.outputDirectory.value = state.currentConfig.outputDirectory || '';
    elements.sourceLanguage.value = state.currentConfig.defaultSourceLanguage;
    elements.targetLanguage.value = state.currentConfig.defaultTargetLanguage;
    elements.defaultSourceLanguage.value = state.currentConfig.defaultSourceLanguage;
    elements.defaultTargetLanguage.value = state.currentConfig.defaultTargetLanguage;
    elements.audioFormat.value = state.currentConfig.audioFormat;
    
    // 更新 SakuraLLM 状态显示
    updateSakuraStatus();
}

/** 更新 SakuraLLM 状态显示 */
export async function updateSakuraStatus() {
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

/** 保存设置 */
export async function saveSettings() {
    try {
        const elements = getElements();
        
        const updates = {
            whisperModelPath: elements.whisperModelPath.value,
            sakuraModelPath: elements.sakuraModelPath.value,
            sakuraGpuLayers: Number.parseInt(elements.sakuraGpuLayers.value, 10),
            outputDirectory: elements.outputDirectory.value,
            defaultSourceLanguage: elements.defaultSourceLanguage.value as 'ja' | 'en',
            defaultTargetLanguage: elements.defaultTargetLanguage.value,
        };
        
        state.currentConfig = await ipcRenderer.invoke(IpcChannels.UPDATE_CONFIG, updates);
        
        // 更新主界面的语言选项
        elements.sourceLanguage.value = updates.defaultSourceLanguage;
        elements.targetLanguage.value = updates.defaultTargetLanguage;
        
        elements.settingsModal.classList.add('hidden');
        alert('设置已保存\n\n提示：如果修改了 SakuraLLM 模型路径，请点击"加载/重新加载 SakuraLLM 模型"按钮');
    } catch (error: any) {
        showError('保存设置失败: ' + error.message);
    }
}

/** 加载 SakuraLLM 模型 */
export async function loadSakuraModel() {
    try {
        const elements = getElements();
        const btn = document.getElementById('loadSakuraModelBtn') as HTMLButtonElement;
        const originalText = btn.textContent;
        
        // 显示加载状态
        btn.disabled = true;
        btn.textContent = '⏳ 加载中...';
        
        const modelPath = elements.sakuraModelPath.value;
        const gpuLayers = Number.parseInt(elements.sakuraGpuLayers.value, 10);
        
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
