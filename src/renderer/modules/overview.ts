/**
 * 总览模式模块
 */

import { state, getElements } from './state';
import { formatTimestamp, escapeHtml } from './utils';
import { renderCurrentSegment } from './editor';

/** 切换到编辑模式 */
export function switchToEditMode() {
    const elements = getElements();
    
    elements.editModeBtn.classList.add('active');
    elements.overviewModeBtn.classList.remove('active');
    elements.editModeContainer.classList.remove('hidden');
    elements.overviewModeContainer.classList.add('hidden');
}

/** 切换到总览模式 */
export function switchToOverviewMode() {
    const elements = getElements();
    
    elements.editModeBtn.classList.remove('active');
    elements.overviewModeBtn.classList.add('active');
    elements.editModeContainer.classList.add('hidden');
    elements.overviewModeContainer.classList.remove('hidden');
    
    // 渲染总览表格
    renderOverviewTable();
}

/** 渲染总览表格 */
export function renderOverviewTable() {
    const elements = getElements();
    
    if (state.currentSegments.length === 0) {
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
    const rows = state.currentSegments.map((seg, index) => {
        const timeStr = formatTimestamp(seg.startTime);
        const speaker = seg.speaker || '';
        const original = seg.text || '';
        const translation = seg.translatedText || '';
        
        // 获取说话人颜色
        const role = state.roles.find(r => r.name === speaker);
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
export function toggleOriginalInOverview() {
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
export function updateSpeakerFilter() {
    const elements = getElements();
    
    const uniqueSpeakers = Array.from(new Set(
        state.currentSegments
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
export function filterOverviewTable() {
    const elements = getElements();
    
    const searchText = elements.overviewSearchInput.value.toLowerCase();
    const selectedSpeaker = elements.speakerFilter.value;
    
    const rows = elements.overviewTableBody.querySelectorAll('tr:not(.empty-row)');
    
    rows.forEach((row) => {
        const index = Number.parseInt(row.getAttribute('data-index') || '0');
        const seg = state.currentSegments[index];
        
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
export function selectSegmentFromOverview(index: number) {
    state.currentSegmentIndex = index;
    switchToEditMode();
    renderCurrentSegment();
}

// 将函数挂载到 window 以便 HTML onclick 调用
(window as any).selectSegmentFromOverview = selectSegmentFromOverview;
