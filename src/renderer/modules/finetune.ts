/**
 * 微调数据编辑器模块 - ChatML 格式多轮对话
 */

import { state, addFinetuneItem, removeFinetuneItem, updateFinetuneItem, setEditingConversation } from './state';
import type { FinetuneDataItem, ChatMessage } from './types';
import { escapeHtml, generateId, ipcRenderer, IpcChannels } from './utils';

// ==================== Tab 切换功能 ====================

/** 切换到字幕编辑 Tab */
export function switchToSubtitleTab() {
    const subtitleTabBtn = document.getElementById('subtitleTabBtn');
    const finetuneTabBtn = document.getElementById('finetuneTabBtn');
    const subtitleWorkspace = document.getElementById('subtitleWorkspace');
    const finetuneWorkspace = document.getElementById('finetuneWorkspace');
    
    subtitleTabBtn?.classList.add('active');
    finetuneTabBtn?.classList.remove('active');
    subtitleWorkspace?.classList.remove('hidden');
    finetuneWorkspace?.classList.add('hidden');
}

/** 切换到微调数据 Tab */
export function switchToFinetuneTab() {
    const subtitleTabBtn = document.getElementById('subtitleTabBtn');
    const finetuneTabBtn = document.getElementById('finetuneTabBtn');
    const subtitleWorkspace = document.getElementById('subtitleWorkspace');
    const finetuneWorkspace = document.getElementById('finetuneWorkspace');
    
    subtitleTabBtn?.classList.remove('active');
    finetuneTabBtn?.classList.add('active');
    subtitleWorkspace?.classList.add('hidden');
    finetuneWorkspace?.classList.remove('hidden');
    
    // 渲染微调编辑器
    renderSourceTable();
    renderConversationList();
}

/** 初始化微调编辑器事件监听 */
export function initFinetuneEditor() {
    // Tab 切换
    document.getElementById('subtitleTabBtn')?.addEventListener('click', switchToSubtitleTab);
    document.getElementById('finetuneTabBtn')?.addEventListener('click', switchToFinetuneTab);
    
    // 工具栏按钮
    document.getElementById('importFinetuneBtn')?.addEventListener('click', importFinetuneData);
    document.getElementById('exportFinetuneBtn')?.addEventListener('click', exportFinetuneData);
    document.getElementById('systemPromptBtn')?.addEventListener('click', openSystemPromptModal);
    document.getElementById('newConversationBtn')?.addEventListener('click', createNewConversation);
    
    // 清空按钮
    document.getElementById('clearDatasetBtn')?.addEventListener('click', clearDataset);
    
    // 角色筛选
    document.getElementById('sourceRoleFilter')?.addEventListener('change', () => renderSourceTable());
    
    // 对话编辑器按钮
    document.getElementById('addUserMsgBtn')?.addEventListener('click', () => addMessageToEditor('user'));
    document.getElementById('addAssistantMsgBtn')?.addEventListener('click', () => addMessageToEditor('assistant'));
    document.getElementById('saveConversationBtn')?.addEventListener('click', saveCurrentConversation);
    
    // 快捷添加功能
    document.getElementById('quickAddUserBtn')?.addEventListener('click', () => {
        const input = document.getElementById('quickUserInput') as HTMLInputElement;
        if (input && input.value.trim()) {
            addMessageToEditor('user', input.value.trim());
            input.value = '';
        }
    });
    
    document.getElementById('quickAddAssistantBtn')?.addEventListener('click', () => {
        const input = document.getElementById('quickAssistantInput') as HTMLInputElement;
        if (input && input.value.trim()) {
            addMessageToEditor('assistant', input.value.trim());
            input.value = '';
        }
    });
    
    // 快捷输入回车发送
    document.getElementById('quickUserInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('quickAddUserBtn')?.click();
        }
    });
    
    document.getElementById('quickAssistantInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('quickAddAssistantBtn')?.click();
        }
    });
    
    // System Prompt 对话框
    setupSystemPromptModal();
    
    // 初始化拖动调整大小
    initResizablePanel();
    
    // 初始化 System Prompt 显示
    updateSystemPromptDisplay();
}

/** 更新 System Prompt 显示 */
function updateSystemPromptDisplay() {
    const display = document.getElementById('currentSystemPrompt');
    if (display) {
        const text = state.globalSystemPrompt;
        display.textContent = text.length > 100 ? text.substring(0, 100) + '...' : text;
    }
}

/** 初始化可拖动调整大小的面板 */
function initResizablePanel() {
    // 左右分割条
    const panelResizer = document.getElementById('panelResizer');
    const sourcePanel = document.getElementById('finetuneSourcePanel');
    const editorPanel = document.getElementById('finetuneEditorPanel');
    
    if (panelResizer && sourcePanel && editorPanel) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        panelResizer.addEventListener('mousedown', (e: MouseEvent) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sourcePanel.offsetWidth;
            panelResizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!isResizing) return;
            
            const diff = e.clientX - startX;
            const newWidth = Math.max(280, Math.min(startWidth + diff, window.innerWidth * 0.5));
            sourcePanel.style.flex = `0 0 ${newWidth}px`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                panelResizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
    
    // 上下分割条 (字幕源 和 对话列表 之间)
    const sourceConvResizer = document.getElementById('sourceConvResizer');
    const sourceSection = document.getElementById('sourceSection');
    const convSection = document.getElementById('convSection');
    
    if (sourceConvResizer && sourceSection && convSection) {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        
        sourceConvResizer.addEventListener('mousedown', (e: MouseEvent) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = sourceSection.offsetHeight;
            sourceConvResizer.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!isResizing) return;
            
            const diff = e.clientY - startY;
            const parentHeight = sourceSection.parentElement?.offsetHeight || 500;
            const newHeight = Math.max(120, Math.min(startHeight + diff, parentHeight - 150));
            sourceSection.style.flex = `0 0 ${newHeight}px`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                sourceConvResizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}

/** 创建新对话 */
function createNewConversation() {
    const newItem: FinetuneDataItem = {
        id: generateId('conv'),
        type: 'chatml',
        messages: [
            { role: 'system', content: state.globalSystemPrompt }
        ],
        sourceSegmentIds: []
    };
    
    addFinetuneItem(newItem);
    state.selectedFinetuneIndex = state.finetuneDataset.length - 1;
    setEditingConversation(newItem);
    renderConversationList();
    loadConversationToEditor(newItem);
}

/** 选择对话 */
function selectConversation(index: number) {
    state.selectedFinetuneIndex = index;
    const item = state.finetuneDataset[index];
    if (item) {
        setEditingConversation(item);
        loadConversationToEditor(item);
    }
    renderConversationList();
}

/** 加载对话到编辑器 */
function loadConversationToEditor(item: FinetuneDataItem) {
    clearConversationEditor();
    
    for (const msg of item.messages) {
        if (msg.role === 'system') {
            // system 消息显示在顶部
            const systemDisplay = document.getElementById('currentSystemPrompt');
            if (systemDisplay) {
                systemDisplay.textContent = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
            }
        } else {
            addMessageToEditor(msg.role, msg.content);
        }
    }
}

/** 清空对话编辑器 */
function clearConversationEditor() {
    // 重置选中状态
    state.selectedFinetuneIndex = -1;
    setEditingConversation(null);
    
    // 清空消息容器并显示空状态
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <p>选择或新建一个对话开始编辑</p>
                <p class="hint">从左侧字幕源添加对话内容，或手动添加消息</p>
            </div>
        `;
    }
    
    const systemDisplay = document.getElementById('currentSystemPrompt');
    if (systemDisplay) {
        systemDisplay.textContent = state.globalSystemPrompt.substring(0, 100) + '...';
    }
    
    // 更新对话列表（移除高亮）
    renderConversationList();
}

/** 添加消息到编辑器 (支持连续同角色消息合并) */
function addMessageToEditor(role: 'user' | 'assistant', content: string = '') {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    // 如果容器中有空状态提示，先清除
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // 检查最后一条消息是否是同样的角色，如果是则合并
    const lastMessage = container.querySelector('.message-item:last-child') as HTMLElement;
    if (lastMessage && lastMessage.dataset.role === role && content) {
        // 合并到最后一条消息
        const textarea = lastMessage.querySelector('.message-content') as HTMLTextAreaElement;
        if (textarea) {
            const existingContent = textarea.value.trim();
            // 用换行符连接内容
            textarea.value = existingContent ? `${existingContent}\n${content}` : content;
            // 调整文本框高度
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            // 滚动到底部
            container.scrollTop = container.scrollHeight;
            // 高亮显示合并效果
            lastMessage.classList.add('merged-highlight');
            setTimeout(() => lastMessage.classList.remove('merged-highlight'), 500);
            return;
        }
    }
    
    const msgId = generateId('msg');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message-item ${role}`;
    msgDiv.dataset.msgId = msgId;
    msgDiv.dataset.role = role;
    
    msgDiv.innerHTML = `
        <div class="message-header">
            <span class="message-role">${role === 'user' ? '👤 用户' : '🤖 助手'}</span>
            <button class="btn btn-small btn-danger delete-msg-btn" title="删除消息">🗑️</button>
        </div>
        <textarea class="message-content" placeholder="${role === 'user' ? '输入用户的问题或对话...' : '输入角色的回复...'}">${escapeHtml(content)}</textarea>
    `;
    
    container.appendChild(msgDiv);
    
    // 绑定删除按钮
    const deleteBtn = msgDiv.querySelector('.delete-msg-btn');
    deleteBtn?.addEventListener('click', () => {
        msgDiv.remove();
        // 如果删除后没有消息了，显示空状态
        if (container.querySelectorAll('.message-item').length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>选择或新建一个对话开始编辑</p>
                    <p class="hint">从左侧字幕源添加对话内容，或手动添加消息</p>
                </div>
            `;
        }
    });
    
    // 聚焦到新添加的文本框
    const textarea = msgDiv.querySelector('textarea');
    textarea?.focus();
    
    // 滚动到底部
    container.scrollTop = container.scrollHeight;
}

/** 验证对话格式 (必须以 user 开始，assistant 结束) */
function validateConversationFormat(messages: ChatMessage[]): { valid: boolean; error?: string } {
    // 过滤掉 system 消息
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    if (conversationMessages.length === 0) {
        return { valid: false, error: '对话中没有有效的消息（至少需要一条用户消息和一条助手回复）' };
    }
    
    // 检查是否以 user 开始
    const firstMsg = conversationMessages[0];
    if (firstMsg.role !== 'user') {
        return { 
            valid: false, 
            error: '对话必须以【用户消息】开始\n\n当前第一条消息是助手回复，请在开头添加一条用户消息。' 
        };
    }
    
    // 检查是否以 assistant 结束
    const lastMsg = conversationMessages[conversationMessages.length - 1];
    if (lastMsg.role !== 'assistant') {
        return { 
            valid: false, 
            error: '对话必须以【助手回复】结束\n\n当前最后一条消息是用户消息，请在结尾添加助手的回复。' 
        };
    }
    
    return { valid: true };
}

/** 保存当前对话 */
function saveCurrentConversation() {
    // 收集消息
    const messages: ChatMessage[] = [];
    
    // 添加 system 消息
    messages.push({ role: 'system', content: state.globalSystemPrompt });
    
    // 收集编辑器中的消息
    const container = document.getElementById('messagesContainer');
    if (container) {
        const msgItems = Array.from(container.querySelectorAll('.message-item'));
        for (const msgItem of msgItems) {
            const role = (msgItem as HTMLElement).dataset.role as 'user' | 'assistant';
            const textarea = msgItem.querySelector('.message-content') as HTMLTextAreaElement;
            const content = textarea?.value || '';
            
            if (content.trim()) {
                messages.push({ role, content: content.trim() });
            }
        }
    }
    
    // 检查是否有有效消息
    if (messages.length <= 1) {
        alert('请至少添加一条用户或助手消息');
        return;
    }
    
    // 验证对话格式
    const validation = validateConversationFormat(messages);
    if (!validation.valid) {
        alert(`⚠️ 对话格式不正确\n\n${validation.error}`);
        return;
    }
    
    // 如果没有选中对话，创建新对话
    if (state.selectedFinetuneIndex < 0) {
        const newItem: FinetuneDataItem = {
            id: generateId('conv'),
            type: 'chatml',
            messages,
            sourceSegmentIds: []
        };
        addFinetuneItem(newItem);
        state.selectedFinetuneIndex = state.finetuneDataset.length - 1;
        setEditingConversation(newItem);
    } else {
        // 更新现有对话
        const item = state.finetuneDataset[state.selectedFinetuneIndex];
        if (item) {
            updateFinetuneItem(state.selectedFinetuneIndex, { ...item, messages });
        }
    }
    
    renderConversationList();
    alert('✅ 对话已保存！');
    
    // 保存后清空编辑器，准备编辑下一组对话
    clearConversationEditor();
}

// ==================== 渲染函数 ====================

/** 更新角色筛选下拉框 */
function updateRoleFilter() {
    const select = document.getElementById('sourceRoleFilter') as HTMLSelectElement;
    if (!select) return;
    
    const currentValue = select.value;
    const roles = new Set<string>();
    
    for (const seg of state.currentSegments) {
        if (seg.speaker) {
            roles.add(seg.speaker);
        }
    }
    
    let options = '<option value="">全部角色</option>';
    for (const role of roles) {
        options += `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`;
    }
    
    select.innerHTML = options;
    select.value = currentValue;
}

/** 获取说话人对应的颜色 */
function getSpeakerColor(speaker: string | undefined): string {
    if (!speaker) return '';
    
    // 从 state.roles 中查找匹配的角色
    const role = state.roles.find(r => r.name === speaker);
    if (role) {
        return role.color;
    }
    
    // 如果在 speakers 列表中但没有角色定义，使用默认颜色
    const speakerIndex = state.speakers.indexOf(speaker);
    if (speakerIndex >= 0) {
        // 预定义的颜色列表
        const defaultColors = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548'];
        return defaultColors[speakerIndex % defaultColors.length];
    }
    
    return '';
}

/** 渲染源字幕表格 (简化版，带添加按钮，按说话人颜色显示) */
function renderSourceTable() {
    const tableBody = document.getElementById('sourceTableBody');
    if (!tableBody) return;
    
    updateRoleFilter();
    
    const roleFilter = (document.getElementById('sourceRoleFilter') as HTMLSelectElement)?.value || '';
    
    let filteredSegments = state.currentSegments;
    if (roleFilter) {
        filteredSegments = state.currentSegments.filter(seg => seg.speaker === roleFilter);
    }
    
    if (filteredSegments.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="3">
                    <div class="empty-state small">
                        <p>请先在字幕编辑器中处理视频</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = filteredSegments.map((seg) => {
        const originalIndex = state.currentSegments.indexOf(seg);
        const role = seg.speaker || '未分配';
        // 使用译文，如果没有则用原文
        const text = seg.translatedText || seg.text || '';
        
        // 获取说话人颜色
        const speakerColor = getSpeakerColor(seg.speaker);
        const bgStyle = speakerColor ? `background-color: ${speakerColor}20; border-left: 3px solid ${speakerColor};` : '';
        
        return `
            <tr data-index="${originalIndex}" style="${bgStyle}">
                <td class="col-role"><span class="role-tag" style="${speakerColor ? `background-color: ${speakerColor}; color: white;` : ''}">${escapeHtml(role)}</span></td>
                <td class="col-text">${escapeHtml(text)}</td>
                <td class="col-action">
                    <button class="btn add-btn" data-index="${originalIndex}" title="添加为用户消息">👤+</button>
                    <button class="btn add-btn assistant" data-index="${originalIndex}" title="添加为助手消息">🤖+</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
    
    // 绑定添加按钮事件
    const addButtons = Array.from(tableBody.querySelectorAll('.add-btn'));
    for (const btn of addButtons) {
        btn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            const index = Number.parseInt((btn as HTMLElement).dataset.index || '0');
            const isAssistant = (btn as HTMLElement).classList.contains('assistant');
            const seg = state.currentSegments[index];
            if (seg) {
                const content = seg.translatedText || seg.text || '';
                addMessageToEditor(isAssistant ? 'assistant' : 'user', content);
            }
        });
    }
}

/** 渲染对话列表 */
function renderConversationList() {
    const listContainer = document.getElementById('conversationList');
    if (!listContainer) return;
    
    updateDatasetStats();
    
    if (state.finetuneDataset.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state small">
                <p>暂无对话数据</p>
                <p class="hint">点击"新建对话"开始</p>
            </div>
        `;
        return;
    }
    
    const items = state.finetuneDataset.map((item, index) => {
        const isSelected = state.selectedFinetuneIndex === index;
        const msgCount = item.messages.filter(m => m.role !== 'system').length;
        const preview = item.messages.find(m => m.role === 'user')?.content.substring(0, 30) || '空对话';
        
        return `
            <div class="conversation-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                <div class="conv-preview">${escapeHtml(preview)}${preview.length >= 30 ? '...' : ''}</div>
                <div class="conv-meta">${msgCount} 条消息</div>
                <button class="conv-delete-btn" data-index="${index}" title="删除">🗑️</button>
            </div>
        `;
    }).join('');
    
    listContainer.innerHTML = items;
    
    // 绑定点击事件
    const convItems = Array.from(listContainer.querySelectorAll('.conversation-item'));
    for (const item of convItems) {
        item.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('conv-delete-btn')) return;
            
            const index = Number.parseInt((item as HTMLElement).dataset.index || '0');
            selectConversation(index);
        });
    }
    
    // 绑定删除按钮
    const deleteButtons = Array.from(listContainer.querySelectorAll('.conv-delete-btn'));
    for (const btn of deleteButtons) {
        btn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            const index = Number.parseInt((btn as HTMLElement).dataset.index || '0');
            if (confirm('确定删除这条对话吗？')) {
                removeFinetuneItem(index);
                if (state.selectedFinetuneIndex === index) {
                    state.selectedFinetuneIndex = -1;
                    clearConversationEditor();
                } else if (state.selectedFinetuneIndex > index) {
                    state.selectedFinetuneIndex--;
                }
                renderConversationList();
            }
        });
    }
}

/** 更新数据集统计 */
function updateDatasetStats() {
    const countEl = document.getElementById('finetuneCount');
    const tokensEl = document.getElementById('finetuneTokens');
    
    if (countEl) {
        countEl.textContent = String(state.finetuneDataset.length);
    }
    
    if (tokensEl) {
        // 简单估算 tokens
        let totalChars = 0;
        for (const item of state.finetuneDataset) {
            for (const msg of item.messages) {
                totalChars += msg.content.length;
            }
        }
        const estimatedTokens = Math.ceil(totalChars / 2);
        tokensEl.textContent = String(estimatedTokens);
    }
}

/** 清空数据集 */
function clearDataset() {
    if (state.finetuneDataset.length === 0) {
        alert('数据集已经是空的');
        return;
    }
    
    if (!confirm(`确定要清空数据集吗？当前有 ${state.finetuneDataset.length} 条数据将被删除。`)) {
        return;
    }
    
    state.finetuneDataset.length = 0;
    state.selectedFinetuneIndex = -1;
    clearConversationEditor();
    renderConversationList();
}

// ==================== 导入导出功能 (ChatML 格式) ====================

/** 导入微调数据 (ChatML JSONL 格式) */
async function importFinetuneData() {
    try {
        const path = await ipcRenderer.invoke(IpcChannels.SELECT_FILE, [
            { name: 'JSONL Files', extensions: ['jsonl', 'json'] }
        ]);
        
        if (!path) return;
        
        const content = await ipcRenderer.invoke(IpcChannels.READ_FILE, path);
        const lines = content.trim().split('\n');
        
        let importedCount = 0;
        for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
                const data = JSON.parse(line);
                
                // 支持 ChatML 格式 (messages 数组)
                if (data.messages && Array.isArray(data.messages)) {
                    const item: FinetuneDataItem = {
                        id: generateId('conv'),
                        type: 'chatml',
                        messages: data.messages.map((m: any) => ({
                            role: m.role || 'user',
                            content: m.content || ''
                        }))
                    };
                    addFinetuneItem(item);
                    importedCount++;
                }
                // 兼容旧格式 (system/input/output)
                else if (data.input || data.output) {
                    const messages: ChatMessage[] = [];
                    if (data.system || data.instruction) {
                        messages.push({ role: 'system', content: data.system || data.instruction });
                    }
                    if (data.input || data.prompt || data.question) {
                        messages.push({ role: 'user', content: data.input || data.prompt || data.question });
                    }
                    if (data.output || data.response || data.answer) {
                        messages.push({ role: 'assistant', content: data.output || data.response || data.answer });
                    }
                    
                    const item: FinetuneDataItem = {
                        id: generateId('conv'),
                        type: 'chatml',
                        messages
                    };
                    addFinetuneItem(item);
                    importedCount++;
                }
            } catch {
                console.warn('[Finetune] Failed to parse line:', line);
            }
        }
        
        renderConversationList();
        alert(`成功导入 ${importedCount} 条对话`);
    } catch (error: any) {
        alert('导入失败: ' + error.message);
    }
}

/** 导出微调数据 (ChatML JSONL 格式) */
async function exportFinetuneData() {
    if (state.finetuneDataset.length === 0) {
        alert('没有数据可导出');
        return;
    }
    
    try {
        // 构建 ChatML JSONL 内容
        const lines = state.finetuneDataset.map(item => {
            return JSON.stringify({
                messages: item.messages
            });
        });
        
        const content = lines.join('\n');
        
        const path = await ipcRenderer.invoke(IpcChannels.SAVE_FILE, {
            filters: [{ name: 'JSONL Files', extensions: ['jsonl'] }],
            defaultPath: 'finetune_chatml.jsonl'
        });
        
        if (path) {
            await ipcRenderer.invoke(IpcChannels.WRITE_FILE, path, content);
            alert(`成功导出 ${state.finetuneDataset.length} 条对话到:\n${path}`);
        }
    } catch (error: any) {
        alert('导出失败: ' + error.message);
    }
}

// ==================== System Prompt 对话框 ====================

/** 打开 System Prompt 设置对话框 */
function openSystemPromptModal() {
    const modal = document.getElementById('systemPromptModal');
    const textarea = document.getElementById('globalSystemPrompt') as HTMLTextAreaElement;
    
    if (modal && textarea) {
        textarea.value = state.globalSystemPrompt;
        modal.classList.remove('hidden');
    }
}

/** 设置 System Prompt 对话框事件 */
function setupSystemPromptModal() {
    const modal = document.getElementById('systemPromptModal');
    const closeBtn = document.getElementById('closeSystemPromptModal');
    const cancelBtn = document.getElementById('cancelSystemPromptBtn');
    const saveBtn = document.getElementById('saveSystemPromptBtn');
    
    const closeModal = () => {
        modal?.classList.add('hidden');
    };
    
    // 点击背景关闭
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // 保存
    saveBtn?.addEventListener('click', () => {
        const textarea = document.getElementById('globalSystemPrompt') as HTMLTextAreaElement;
        if (textarea) {
            state.globalSystemPrompt = textarea.value;
            // 更新当前显示
            updateSystemPromptDisplay();
            closeModal();
            alert('角色人格设定已保存');
        }
    });
}
