/**
 * 音频控制模块
 */

import { state, getElements } from './state';
import { formatTime } from './utils';
import type { TranscriptSegment } from '../../shared/types';

/** 切换播放/暂停 */
export function togglePlayPause() {
    if (!state.audioBuffer || !state.audioContext) {
        console.warn('[Audio] No audio loaded');
        return;
    }
    
    if (state.isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
}

/** 播放音频 */
export function playAudio() {
    if (!state.audioBuffer || !state.audioContext) return;
    
    const segment = state.currentSegments[state.currentSegmentIndex];
    if (!segment) return;
    
    const elements = getElements();
    
    // 停止之前的播放
    if (state.audioSource) {
        state.audioSource.stop();
        state.audioSource = null;
    }
    
    // 创建新的音频源
    state.audioSource = state.audioContext.createBufferSource();
    state.audioSource.buffer = state.audioBuffer;
    state.audioSource.connect(state.audioContext.destination);
    
    // 计算播放的起始位置和持续时间
    const startTime = segment.startTime;
    const endTime = segment.endTime;
    const duration = endTime - startTime;
    
    // 如果有暂停位置且在当前段落范围内，从暂停位置继续
    let startOffset = startTime;
    let playDuration = duration;
    
    if (state.pausedAt > 0 && state.pausedAt >= startTime && state.pausedAt < endTime) {
        startOffset = state.pausedAt;
        playDuration = endTime - state.pausedAt;
    }
    
    // 开始播放，只播放当前段落的时间范围
    state.audioSource.start(0, startOffset, playDuration);
    state.playbackStartTime = state.audioContext.currentTime - startOffset;
    state.isPlaying = true;
    
    // 更新按钮
    if (elements.playPauseBtn) {
        elements.playPauseBtn.textContent = '⏸️';
    }
    
    // 监听播放结束
    state.audioSource.onended = () => {
        if (state.isPlaying) {
            stopAudio();
        }
    };
    
    // 开始更新时间显示
    updatePlaybackTime();
    
    console.log('[Audio] Playing segment from:', startOffset, 'to:', endTime, '(duration:', playDuration, ')');
}

/** 暂停音频 */
export function pauseAudio() {
    if (!state.audioContext || !state.audioSource) return;
    
    const elements = getElements();
    
    state.audioSource.stop();
    state.audioSource = null;
    
    state.pausedAt = state.audioContext.currentTime - state.playbackStartTime;
    state.isPlaying = false;
    
    // 更新按钮
    if (elements.playPauseBtn) {
        elements.playPauseBtn.textContent = '▶️';
    }
    
    console.log('[Audio] Paused at:', state.pausedAt);
}

/** 停止音频 */
export function stopAudio() {
    const elements = getElements();
    
    if (state.audioSource) {
        try {
            state.audioSource.stop();
        } catch {
            // 可能已经停止了
        }
        state.audioSource = null;
    }
    
    state.isPlaying = false;
    state.pausedAt = 0;
    
    // 更新按钮和时间
    if (elements.playPauseBtn) {
        elements.playPauseBtn.textContent = '▶️';
    }
    if (elements.currentTime) {
        elements.currentTime.textContent = '0:00';
    }
    
    // 更新段落总时长
    const segment = state.currentSegments[state.currentSegmentIndex];
    if (segment && elements.totalDuration) {
        elements.totalDuration.textContent = formatTime(segment.endTime - segment.startTime);
    }
    
    console.log('[Audio] Stopped');
}

/** 更新播放时间显示 */
function updatePlaybackTime() {
    if (!state.isPlaying || !state.audioContext) return;
    
    const elements = getElements();
    const segment = state.currentSegments[state.currentSegmentIndex];
    if (!segment) return;
    
    const currentPlayTime = state.audioContext.currentTime - state.playbackStartTime;
    
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
    if (state.isPlaying) {
        requestAnimationFrame(updatePlaybackTime);
    }
}

/** 绘制波形 */
export function drawWaveformForSegment(segment: TranscriptSegment) {
    const canvas = document.getElementById('waveformCanvas') as HTMLCanvasElement;
    const placeholder = document.getElementById('waveformPlaceholder');
    
    if (!canvas || !state.audioBuffer) {
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
    const channelData = state.audioBuffer.getChannelData(0);
    const sampleRate = state.audioBuffer.sampleRate;
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
export async function loadAudioForWaveform(audioPath: string) {
    const elements = getElements();
    
    try {
        console.log('[Waveform] Loading audio from:', audioPath);
        
        if (!state.audioContext) {
            state.audioContext = new AudioContext();
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
        
        state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
        
        console.log('[Waveform] Audio decoded successfully, duration:', state.audioBuffer.duration);
        
        // 启用播放按钮并更新时长
        if (elements.playPauseBtn) {
            elements.playPauseBtn.disabled = false;
        }
        
        // 显示当前段落的时长
        if (elements.totalDuration && state.currentSegments.length > 0) {
            const segment = state.currentSegments[state.currentSegmentIndex];
            elements.totalDuration.textContent = formatTime(segment.endTime - segment.startTime);
        }
        
        // 立即绘制当前段落的波形
        if (state.currentSegments.length > 0) {
            drawWaveformForSegment(state.currentSegments[state.currentSegmentIndex]);
        }
    } catch (error) {
        console.error('[Waveform] Failed to load audio:', error);
    }
}
