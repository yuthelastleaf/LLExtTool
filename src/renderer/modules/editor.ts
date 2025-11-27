/**
 * 字幕编辑器模块 - 三段式编辑器
 */

import { state, getElements, addRole, removeRole } from './state';
import type { Role } from './types';
import { formatTime, ipcRenderer, IpcChannels } from './utils';
import { stopAudio, drawWaveformForSegment } from './audio';

/** 初始化新编辑器 */
export function initNewEditor() {
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
            state.showOriginalText = !state.showOriginalText;
            renderCurrentSegment();
        });
    }

    // 翻译当前段落
    if (translateCurrentBtn) {
        translateCurrentBtn.addEventListener('click', async () => {
            console.log('[Editor] Translate current segment clicked');
            if (state.currentSegments.length === 0) return;
            
            const segment = state.currentSegments[state.currentSegmentIndex];
            if (!segment || !segment.text) {
                alert('当前段落没有原文可翻译');
                return;
            }
            
            try {
                // 显示加载状态
                const originalIcon = translateCurrentBtn.innerHTML;
                translateCurrentBtn.innerHTML = '<span class="translate-icon">⏳</span>';
                translateCurrentBtn.disabled = true;
                
                const elements = getElements();
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
            console.log('[Editor] Previous segment clicked, current index:', state.currentSegmentIndex);
            if (state.currentSegmentIndex > 0) {
                state.currentSegmentIndex--;
                renderCurrentSegment();
                renderRoles();
            }
        });
    }
    
    if (nextSegmentBtn) {
        nextSegmentBtn.addEventListener('click', () => {
            console.log('[Editor] Next segment clicked, current index:', state.currentSegmentIndex);
            if (state.currentSegmentIndex < state.currentSegments.length - 1) {
                state.currentSegmentIndex++;
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
            const color = colors[state.roles.length % colors.length];
            addRole({
                id: `role-${Date.now()}`,
                name: name,
                color: color
            });
            console.log('[Editor] Role added:', name, '- Total roles:', state.roles.length);
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
export function renderCurrentSegment() {
    const container = document.getElementById('textEditorContent');
    const segmentCounter = document.getElementById('segmentCounter');
    const prevBtn = document.getElementById('prevSegmentBtn') as HTMLButtonElement;
    const nextBtn = document.getElementById('nextSegmentBtn') as HTMLButtonElement;
    
    // 停止当前播放
    if (state.isPlaying) {
        stopAudio();
    }
    
    if (!container || state.currentSegments.length === 0) {
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
    
    const segment = state.currentSegments[state.currentSegmentIndex];
    
    // 更新计数器
    if (segmentCounter) {
        segmentCounter.textContent = `${state.currentSegmentIndex + 1} / ${state.currentSegments.length}`;
    }
    
    // 更新按钮状态
    if (prevBtn) prevBtn.disabled = state.currentSegmentIndex === 0;
    if (nextBtn) nextBtn.disabled = state.currentSegmentIndex === state.currentSegments.length - 1;
    
    // 渲染编辑器
    container.innerHTML = `
        <div class="segment-editor">
            <div class="segment-time-info">
                <span class="time-badge">${formatTime(segment.startTime)} → ${formatTime(segment.endTime)}</span>
                <span>段落 ${state.currentSegmentIndex + 1}</span>
            </div>
            
            <div class="text-field">
                <label class="text-field-label">译文</label>
                <textarea id="translatedTextArea" rows="4">${segment.translatedText || segment.text}</textarea>
            </div>
            
            ${state.showOriginalText ? `
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
            state.currentSegments[state.currentSegmentIndex].translatedText = target.value;
        });
    }
    
    // 绘制波形（如果有音频）
    drawWaveformForSegment(segment);
}

/** 渲染角色列表 */
export function renderRoles() {
    const roleList = document.getElementById('roleList');
    if (!roleList) return;
    
    if (state.roles.length === 0) {
        roleList.innerHTML = `
            <div class="empty-role-state">
                点击右上角 ➕ 按钮添加角色
            </div>
        `;
        return;
    }
    
    roleList.innerHTML = state.roles.map((role, index) => `
        <div class="role-item ${state.currentSegments[state.currentSegmentIndex]?.speaker === role.name ? 'active' : ''}" 
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
                if (roleId) {
                    removeRole(roleId);
                    renderRoles();
                }
                return;
            }
            
            const roleId = (item as HTMLElement).dataset.roleId;
            const role = state.roles.find(r => r.id === roleId);
            if (role && state.currentSegments[state.currentSegmentIndex]) {
                state.currentSegments[state.currentSegmentIndex].speaker = role.name;
                renderRoles();
            }
        });
    });
}

/**
 * 从字幕段中提取说话人并添加到角色列表
 */
export function extractSpeakersFromSegments() {
    // 收集所有唯一的说话人
    const speakerSet = new Set<string>();
    state.currentSegments.forEach(seg => {
        if (seg.speaker && seg.speaker.trim() !== '') {
            speakerSet.add(seg.speaker);
        }
    });
    
    // 为每个新的说话人添加角色（如果还不存在）
    const colors = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#cddc39', '#ff5722'];
    let colorIndex = state.roles.length % colors.length;
    
    speakerSet.forEach(speaker => {
        // 检查是否已存在
        const exists = state.roles.some(role => role.name === speaker);
        if (!exists) {
            addRole({
                id: `role-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                name: speaker,
                color: colors[colorIndex % colors.length]
            });
            colorIndex++;
        }
    });
    
    // 更新角色显示
    renderRoles();
}
