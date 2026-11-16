import { SubtitleCue } from '@/types/watch-party';

/**
 * Strips HTML tags (<...>), ASS/SSA override tags ({...}), and decodes standard HTML entities.
 */
export function cleanSubtitleText(raw: string): string {
  if (!raw) return '';

  return raw
    // Remove ASS/SSA tags like {\an8}, {\pos(x,y)}, etc.
    .replace(/\{[^}]+\}/g, '')
    // Remove HTML tags like <i>, <b>, <font color="...">, etc.
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parses a timestamp string in SRT (00:00:00,000) or VTT (00:00:00.000 or 00:00.000) format into seconds.
 */
export function parseTimestamp(timeStr: string): number | null {
  const normalized = timeStr.trim().replace(',', '.');
  // Match [hours:]minutes:seconds[.milliseconds]
  const match = normalized.match(/(?:(?:(\d+):)?(\d{1,2}):)?(\d{1,2})(?:\.(\d+))?/);
  if (!match) return null;

  // Let's handle both hh:mm:ss.mmm and mm:ss.mmm
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }

  return null;
}

/**
 * Parses .srt or .vtt file text into an array of SubtitleCue objects.
 */
export function parseSubtitles(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  // Normalize CRLF to LF and trim
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Check for WEBVTT header line or comments
    if (lines[0].toUpperCase().startsWith('WEBVTT') || lines[0].startsWith('NOTE')) {
      continue;
    }

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startStr, ...rest] = timeLine.split('-->');
    if (!startStr || rest.length === 0) continue;

    // The end string might contain cue settings (e.g. line:0 position:20% align:start)
    const endStr = rest.join('-->').trim().split(/\s+/)[0];

    const startTime = parseTimestamp(startStr);
    const endTime = parseTimestamp(endStr);

    if (startTime === null || endTime === null || isNaN(startTime) || isNaN(endTime)) {
      continue;
    }

    // Text lines are everything after timeLineIndex
    const textLines = lines.slice(timeLineIndex + 1);
    const cleanedText = textLines.map(cleanSubtitleText).filter(Boolean).join('\n');

    if (cleanedText) {
      cues.push({
        id: timeLineIndex > 0 ? lines[0] : undefined,
        startTime,
        endTime,
        text: cleanedText,
      });
    }
  }

  // Sort cues by startTime
  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

/**
 * Formats time in seconds to HH:MM:SS or MM:SS string.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';

  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
