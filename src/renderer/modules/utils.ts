/**
 * 通用工具函数
 */

const { ipcRenderer } = require('electron');
const { IpcChannels } = require('../../shared/types');

/** 格式化时间 (秒 -> HH:MM:SS,mmm) */
export function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** 格式化时长 (秒 -> H:MM:SS 或 M:SS) */
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
}

/** 格式化时间戳 (秒 -> MM:SS) */
export function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** 数字补零 */
export function pad(num: number, size: number = 2): string {
    return num.toString().padStart(size, '0');
}

/** 显示错误信息 */
export function showError(message: string): void {
    alert(message);
    console.error(message);
}

/** HTML 转义 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/** 生成唯一 ID */
export function generateId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** IPC 渲染器 */
export { ipcRenderer, IpcChannels };
