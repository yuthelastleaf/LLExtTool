/**
 * 字幕解析模块
 */

import type { TranscriptSegment } from '../../shared/types';

/**
 * 解析 SRT 格式
 */
export function parseSRT(content: string): TranscriptSegment[] {
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
            translatedText: translatedText || text,  // 无翻译时使用原文
            speaker,
            language: 'ja'
        });
    }
    
    return segments;
}

/**
 * 解析 VTT 格式
 */
export function parseVTT(content: string): TranscriptSegment[] {
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
                translatedText: translatedText || text,  // 无翻译时使用原文
                speaker,
                language: 'ja'
            });
        }
        i++;
    }
    
    return segments;
}

/**
 * 解析 ASS/SSA 格式
 * 只提取对话文本，忽略样式等信息
 * 支持双语 ASS 文件（如 jpsc_v2.ass），根据样式名称区分日文和中文
 */
export function parseASS(content: string): TranscriptSegment[] {
    const lines = content.split('\n');
    
    // 查找 [Events] 部分
    let inEvents = false;
    let formatFields: string[] = [];
    
    // 存储所有对话行，按时间分组
    interface DialogueEntry {
        startTime: number;
        endTime: number;
        style: string;
        name: string;
        text: string;
    }
    const dialogues: DialogueEntry[] = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 检测 [Events] 部分
        if (trimmedLine.toLowerCase() === '[events]') {
            inEvents = true;
            continue;
        }
        
        // 检测其他部分开始，结束 Events
        if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']') && inEvents) {
            break;
        }
        
        if (!inEvents) continue;
        
        // 解析 Format 行
        if (trimmedLine.toLowerCase().startsWith('format:')) {
            const formatLine = trimmedLine.substring(7).trim();
            formatFields = formatLine.split(',').map(f => f.trim().toLowerCase());
            continue;
        }
        
        // 解析 Dialogue 行
        if (trimmedLine.toLowerCase().startsWith('dialogue:')) {
            const dialogueContent = trimmedLine.substring(9).trim();
            const values = parseASSDialogueLine(dialogueContent, formatFields.length);
            
            if (values.length < formatFields.length) continue;
            
            // 获取各字段索引
            const startIdx = formatFields.indexOf('start');
            const endIdx = formatFields.indexOf('end');
            const styleIdx = formatFields.indexOf('style');
            const nameIdx = formatFields.indexOf('name');
            const textIdx = formatFields.indexOf('text');
            
            if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;
            
            const startTime = parseASSTime(values[startIdx]);
            const endTime = parseASSTime(values[endIdx]);
            const style = styleIdx !== -1 ? values[styleIdx] : '';
            const name = nameIdx !== -1 ? values[nameIdx] : '';
            let text = cleanASSText(values[textIdx]);
            
            if (!text) continue;
            
            dialogues.push({ startTime, endTime, style, name, text });
        }
    }
    
    // 检测是否为双语文件（包含 JP/JPN 和 SC/CHS/CN 样式）
    const hasJP = dialogues.some(d => isJapaneseStyle(d.style));
    const hasSC = dialogues.some(d => isChineseStyle(d.style));
    const isBilingual = hasJP && hasSC;
    
    if (isBilingual) {
        // 双语模式：按时间匹配日文和中文
        return parseBilingualASS(dialogues);
    } else {
        // 单语模式：所有对话作为原文
        return dialogues.map((d, index) => ({
            id: `seg_${Date.now()}_${index}`,
            startTime: d.startTime,
            endTime: d.endTime,
            text: d.text,
            translatedText: d.text,  // 无翻译时使用原文
            speaker: d.name || undefined,
            language: 'ja' as const
        }));
    }
}

/**
 * 判断是否为日文样式
 */
function isJapaneseStyle(style: string): boolean {
    const s = style.toLowerCase();
    return s.includes('jp') || s.includes('jpn') || s.includes('japanese') || 
           s.includes('ja') || s === 'default';
}

/**
 * 判断是否为中文样式
 */
function isChineseStyle(style: string): boolean {
    const s = style.toLowerCase();
    return s.includes('sc') || s.includes('chs') || s.includes('cn') || 
           s.includes('chinese') || s.includes('zh') || s.includes('gb');
}

/**
 * 解析双语 ASS 文件，匹配日文和中文字幕
 */
function parseBilingualASS(dialogues: Array<{startTime: number; endTime: number; style: string; name: string; text: string}>): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    
    // 分离日文和中文对话
    const jpDialogues = dialogues.filter(d => isJapaneseStyle(d.style));
    const scDialogues = dialogues.filter(d => isChineseStyle(d.style));
    
    // 为每个日文对话找到对应的中文翻译（按时间匹配）
    for (let i = 0; i < jpDialogues.length; i++) {
        const jp = jpDialogues[i];
        
        // 查找时间相同或接近的中文字幕
        const matchedSC = scDialogues.find(sc => 
            Math.abs(sc.startTime - jp.startTime) < 0.1 && 
            Math.abs(sc.endTime - jp.endTime) < 0.1
        );
        
        segments.push({
            id: `seg_${Date.now()}_${i}`,
            startTime: jp.startTime,
            endTime: jp.endTime,
            text: jp.text,  // 日文作为原文
            translatedText: matchedSC ? matchedSC.text : jp.text,  // 中文作为译文
            speaker: jp.name || undefined,
            language: 'ja'
        });
    }
    
    return segments;
}

/**
 * 解析 ASS Dialogue 行的值（处理逗号在文本中的情况）
 */
function parseASSDialogueLine(content: string, fieldCount: number): string[] {
    const values: string[] = [];
    let current = '';
    let commaCount = 0;
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        // 前 fieldCount-1 个字段用逗号分隔
        if (char === ',' && commaCount < fieldCount - 1) {
            values.push(current.trim());
            current = '';
            commaCount++;
        } else {
            current += char;
        }
    }
    
    // 最后一个字段（Text）可能包含逗号
    values.push(current.trim());
    
    return values;
}

/**
 * 解析 ASS 时间格式 (H:MM:SS.CC)
 */
function parseASSTime(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) return 0;
    
    const hours = Number.parseInt(match[1]);
    const minutes = Number.parseInt(match[2]);
    const seconds = Number.parseInt(match[3]);
    const centiseconds = Number.parseInt(match[4]);
    
    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
}

/**
 * 清理 ASS 文本中的标签和特殊字符
 */
function cleanASSText(text: string): string {
    // 移除 {\xxx} 样式标签
    text = text.replace(/\{\\[^}]*\}/g, '');
    
    // 将 \N 和 \n 转换为空格或保持换行
    text = text.replace(/\\[Nn]/g, ' ');
    
    // 移除 \h (硬空格)
    text = text.replace(/\\h/g, ' ');
    
    // 移除其他转义字符
    text = text.replace(/\\[^Nnh]/g, '');
    
    // 清理多余空格
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}
