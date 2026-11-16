export interface SubtitleCue {
  id?: string;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  cues: SubtitleCue[];
  isCustom?: boolean;
}

export interface SubtitleSettings {
  activeTrackId: string | null;
  offsetSeconds: number; // e.g., -10 to +10s
  fontSize: number;      // e.g., 16 to 48px
  fontFamily: string;    // e.g., 'sans-serif', 'serif', 'monospace'
  textColor: string;     // color hex e.g., '#FFFFFF', '#FFFF00'
  edgeStyle: 'none' | 'outline' | 'drop-shadow';
  backgroundOpacity: number; // 0 to 1
  verticalPosition: number;  // % from bottom, e.g., 5 to 50
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'peer' | 'system';
  senderName?: string;
  username?: string;
  text: string;
  timestamp: number;
}

export type SyncMessageType =
  | 'play'
  | 'pause'
  | 'seek'
  | 'rate'
  | 'heartbeat'
  | 'chat'
  | 'reaction'
  | 'file-info';

export interface SyncMessage {
  type: SyncMessageType;
  currentTime?: number;
  playbackRate?: number;
  timestamp?: number;
  text?: string;
  emoji?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  senderName?: string;
  username?: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  username?: string;
  leftPercent: number; // random horizontal position
  bottomOffset: number;
}
