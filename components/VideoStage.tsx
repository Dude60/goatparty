'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Upload,
  RefreshCw,
  Subtitles,
  MessageSquare,
  Share2,
} from 'lucide-react';
import {
  SubtitleSettings,
  SubtitleTrack,
  FloatingReaction,
  SyncMessage,
} from '@/types/watch-party';
import { formatTime } from '@/utils/subtitleParser';

interface VideoStageProps {
  isConnected: boolean;
  videoSrc: string | null;
  videoFileName: string | null;
  onSelectVideo: (file: File) => void;
  subtitleSettings: SubtitleSettings;
  subtitleTracks: SubtitleTrack[];
  onOpenSubtitles: () => void;
  onOpenConnect: () => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
  unreadCount?: number;
  floatingReactions: FloatingReaction[];
  onBroadcastMessage: (msg: SyncMessage) => boolean;
  lastIncomingMessage: SyncMessage | null;
  children?: React.ReactNode;
}

export default function VideoStage({
  isConnected,
  videoSrc,
  videoFileName,
  onSelectVideo,
  subtitleSettings,
  subtitleTracks,
  onOpenSubtitles,
  onOpenConnect,
  onToggleChat,
  isChatOpen,
  unreadCount = 0,
  floatingReactions,
  onBroadcastMessage,
  lastIncomingMessage,
  children,
}: VideoStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Performance refs for zero-re-render scrubber & time updates
  const currentTimeRef = useRef<number>(0);
  const scrubberRef = useRef<HTMLInputElement>(null);
  const progressPlayedRef = useRef<HTMLDivElement>(null);
  const progressBufferedRef = useRef<HTMLDivElement>(null);
  const timeCurrentRef = useRef<HTMLSpanElement>(null);
  const timeDurationRef = useRef<HTMLSpanElement>(null);

  // Low-frequency UI state (only updates on actual user actions)
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Only trigger re-render when subtitle text actually changes
  const [activeCueText, setActiveCueText] = useState<string>('');
  const lastCueTextRef = useRef<string>('');

  // Guard flag to avoid infinite ping-pong loops
  const isRemoteActionRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTemporaryToast = useCallback((msg: string) => {
    setSyncToast(msg);
    setTimeout(() => {
      setSyncToast((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  // Set audio and preload on video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume;
    }
  }, [videoSrc, volume]);

  // Sync fullscreen state with document events (e.g. Esc key or browser shortcuts)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle incoming WebRTC sync messages
  useEffect(() => {
    if (!lastIncomingMessage || !videoRef.current) return;
    const video = videoRef.current;
    const msg = lastIncomingMessage;

    isRemoteActionRef.current = true;

    switch (msg.type) {
      case 'play':
        if (msg.currentTime !== undefined) {
          if (Math.abs(video.currentTime - msg.currentTime) > 0.5) {
            video.currentTime = msg.currentTime;
            currentTimeRef.current = msg.currentTime;
          }
        }
        video.play().catch(() => {});
        setIsPlaying(true);
        showTemporaryToast('Peer started playback ▶');
        break;

      case 'pause':
        if (msg.currentTime !== undefined) {
          if (Math.abs(video.currentTime - msg.currentTime) > 0.5) {
            video.currentTime = msg.currentTime;
            currentTimeRef.current = msg.currentTime;
          }
        }
        video.pause();
        setIsPlaying(false);
        showTemporaryToast('Peer paused playback ⏸');
        break;

      case 'seek':
        if (msg.currentTime !== undefined) {
          video.currentTime = msg.currentTime;
          currentTimeRef.current = msg.currentTime;
          showTemporaryToast(`Peer jumped to ${formatTime(msg.currentTime)} ⏩`);
        }
        break;

      case 'rate':
        if (msg.playbackRate !== undefined) {
          video.playbackRate = msg.playbackRate;
          setPlaybackRate(msg.playbackRate);
          showTemporaryToast(`Peer set speed to ${msg.playbackRate}x`);
        }
        break;

      case 'heartbeat':
        // Drift tolerance set to 3.0s to prevent interrupting hardware video decoding
        if (msg.currentTime !== undefined) {
          const drift = Math.abs(video.currentTime - msg.currentTime);
          if (drift > 3.0) {
            video.currentTime = msg.currentTime;
            currentTimeRef.current = msg.currentTime;
            showTemporaryToast(`Playback synced (${drift.toFixed(1)}s drift corrected)`);
          }
        }
        break;

      default:
        break;
    }

    setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 150);
  }, [lastIncomingMessage, showTemporaryToast]);

  // Periodic heartbeat broadcast every 8000ms (8s) to prevent decoder interruption
  useEffect(() => {
    if (!isConnected || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        onBroadcastMessage({
          type: 'heartbeat',
          currentTime: videoRef.current.currentTime,
          playbackRate: videoRef.current.playbackRate,
          timestamp: Date.now(),
        });
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isConnected, isPlaying, onBroadcastMessage]);

  // Mouse activity timer for hiding controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  };

  // Keyboard shortcut listener (Space = Play/Pause, F = Fullscreen, M = Mute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        ['input', 'textarea'].includes(target?.tagName?.toLowerCase() || '') ||
        ['input', 'textarea'].includes(activeTag || '') ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const togglePlayPause = () => {
    if (!videoRef.current || !videoSrc) return;
    const video = videoRef.current;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      if (!isRemoteActionRef.current) {
        onBroadcastMessage({
          type: 'play',
          currentTime: video.currentTime,
        });
      }
    } else {
      video.pause();
      setIsPlaying(false);
      if (!isRemoteActionRef.current) {
        onBroadcastMessage({
          type: 'pause',
          currentTime: video.currentTime,
        });
      }
    }
  };

  // HIGH PERFORMANCE: Direct DOM updates without React re-renders per frame
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const cur = video.currentTime;
    currentTimeRef.current = cur;
    const dur = video.duration || duration || 1;
    const percent = Math.min(100, Math.max(0, (cur / dur) * 100));

    // Update scrubber UI directly without triggering React re-renders
    if (progressPlayedRef.current) {
      progressPlayedRef.current.style.width = `${percent}%`;
    }
    if (scrubberRef.current) {
      scrubberRef.current.value = String(cur);
    }
    if (timeCurrentRef.current) {
      timeCurrentRef.current.textContent = formatTime(cur);
    }

    // Buffered bar update
    if (video.buffered.length > 0 && progressBufferedRef.current) {
      const bufEnd = video.buffered.end(video.buffered.length - 1);
      const bufPercent = Math.min(100, Math.max(0, (bufEnd / dur) * 100));
      progressBufferedRef.current.style.width = `${bufPercent}%`;
    }

    // Subtitle check: ONLY call setActiveCueText when the string transitions to a new cue or becomes empty
    const activeTrack = subtitleTracks.find((t) => t.id === subtitleSettings.activeTrackId);
    if (activeTrack) {
      const adjustedTime = cur + subtitleSettings.offsetSeconds;
      const currentCue = activeTrack.cues.find(
        (c) => adjustedTime >= c.startTime && adjustedTime <= c.endTime
      );
      const newText = currentCue ? currentCue.text : '';
      if (newText !== lastCueTextRef.current) {
        lastCueTextRef.current = newText;
        setActiveCueText(newText);
      }
    } else if (lastCueTextRef.current !== '') {
      lastCueTextRef.current = '';
      setActiveCueText('');
    }
  };

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    currentTimeRef.current = newTime;

    const dur = videoRef.current.duration || duration || 1;
    if (progressPlayedRef.current) {
      progressPlayedRef.current.style.width = `${(newTime / dur) * 100}%`;
    }
    if (scrubberRef.current) {
      scrubberRef.current.value = String(newTime);
    }
    if (timeCurrentRef.current) {
      timeCurrentRef.current.textContent = formatTime(newTime);
    }

    if (!isRemoteActionRef.current) {
      onBroadcastMessage({
        type: 'seek',
        currentTime: newTime,
      });
    }
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleRateChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);

    if (!isRemoteActionRef.current) {
      onBroadcastMessage({
        type: 'rate',
        playbackRate: rate,
      });
    }
  };

  const handleManualSync = () => {
    if (!videoRef.current) return;
    onBroadcastMessage({
      type: 'seek',
      currentTime: videoRef.current.currentTime,
    });
    showTemporaryToast(`Synced time (${formatTime(videoRef.current.currentTime)})`);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen request failed:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Exit fullscreen failed:', err);
      }
    }
  };

  const getEdgeStyleCss = () => {
    switch (subtitleSettings.edgeStyle) {
      case 'outline':
        return {
          textShadow:
            '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0px 3px 6px rgba(0,0,0,0.9)',
        };
      case 'drop-shadow':
        return {
          textShadow: '3px 4px 6px rgba(0, 0, 0, 0.95), 0px 2px 4px rgba(0, 0, 0, 0.85)',
        };
      case 'none':
      default:
        return {};
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative flex-1 w-full h-full bg-[#121314] flex items-center justify-center overflow-hidden select-none group"
    >
      {/* Video Element with hardware-accelerated compositing */}
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain cursor-pointer will-change-transform transform-gpu"
          onClick={togglePlayPause}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              if (timeDurationRef.current) {
                timeDurationRef.current.textContent = formatTime(videoRef.current.duration);
              }
              videoRef.current.muted = false;
              videoRef.current.volume = volume;
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          preload="auto"
        />
      ) : (
        /* Empty State / Video Picker Dropzone */
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md space-y-6 animate-in fade-in">
          <div className="w-24 h-24 rounded-3xl bg-[#1a1b1d] border border-white/10 flex items-center justify-center text-[#5eead4]">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Select Your Local Video File
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              goatparty plays movies directly from your disk with zero server uploads. Both friends select their file and enjoy synced playback.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mkv,.mp4,.webm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onSelectVideo(file);
              }
            }}
            className="hidden"
            id="video-file-picker"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-7 py-3 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200 flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Open Video File</span>
          </button>
        </div>
      )}

      {/* Floating Emoji Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute text-5xl animate-float-fade"
            style={{
              left: `${reaction.leftPercent}%`,
              bottom: `${reaction.bottomOffset}%`,
            }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      {/* Custom Subtitle Overlay */}
      {videoSrc && activeCueText && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none flex justify-center px-8 transition-all duration-150"
          style={{ bottom: `${subtitleSettings.verticalPosition}%` }}
        >
          <div
            className="text-center transition-all px-4 py-1.5 rounded-lg max-w-[85%] whitespace-pre-line leading-relaxed"
            style={{
              fontFamily: subtitleSettings.fontFamily,
              fontSize: `${subtitleSettings.fontSize}px`,
              color: subtitleSettings.textColor,
              backgroundColor: `rgba(0, 0, 0, ${subtitleSettings.backgroundOpacity})`,
              ...getEdgeStyleCss(),
            }}
          >
            {activeCueText}
          </div>
        </div>
      )}

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-[#1a1b1d]/90 border border-[#5eead4]/40 text-[#5eead4] text-xs font-semibold backdrop-blur-md animate-in fade-in">
          {syncToast}
        </div>
      )}

      {/* PrimeVision Cinema HUD / Controls Overlay */}
      {videoSrc && (
        <div
          className={`absolute inset-x-0 bottom-0 z-30 p-4 md:p-6 transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="bg-[#121314]/85 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 space-y-3">
            {/* Scrubber Bar */}
            <div className="relative group/scrubber cursor-pointer">
              <div className="relative w-full h-1.5 group-hover/scrubber:h-2.5 bg-white/10 rounded-full overflow-hidden transition-all">
                {/* Buffered progress (ref-updated) */}
                <div
                  ref={progressBufferedRef}
                  className="absolute top-0 bottom-0 left-0 bg-white/20"
                  style={{ width: '0%' }}
                />
                {/* Played progress (ref-updated) */}
                <div
                  ref={progressPlayedRef}
                  className="absolute top-0 bottom-0 left-0 bg-[#5eead4] rounded-full"
                  style={{ width: '0%' }}
                />
              </div>

              {/* Scrubber Input (ref-updated directly) */}
              <input
                ref={scrubberRef}
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                defaultValue={0}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              {/* Left Controls: Play, Time, Volume */}
              <div className="flex items-center space-x-3 md:space-x-4">
                <button
                  onClick={togglePlayPause}
                  className="p-2 text-white hover:text-[#5eead4] transition"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                </button>

                {/* Volume Slider & Mute */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-300 hover:text-white transition"
                    title="Mute / Unmute (M)"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : volume > 0.5 ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <Volume1 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 md:w-20 h-1 accent-[#5eead4] cursor-pointer"
                  />
                </div>

                {/* Timestamp (ref-updated for speed) */}
                <div className="text-xs font-mono text-zinc-300 select-none hidden sm:block">
                  <span ref={timeCurrentRef}>00:00</span>
                  <span className="text-zinc-600 mx-1">/</span>
                  <span ref={timeDurationRef}>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls: Sync, Speed, Subtitles, P2P, Chat, Fullscreen */}
              <div className="flex items-center space-x-2">
                {/* Manual Sync Button */}
                {isConnected && (
                  <button
                    onClick={handleManualSync}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-zinc-200 hover:text-[#5eead4] text-xs font-medium border border-white/10 transition"
                    title="Force sync time with peer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Sync</span>
                  </button>
                )}

                {/* Speed Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-mono font-bold border border-white/10 transition"
                    title="Playback Speed"
                  >
                    {playbackRate}x
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 right-0 bg-[#1a1b1d] border border-white/10 rounded-2xl p-1 space-y-0.5 min-w-[75px] z-50">
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handleRateChange(rate)}
                          className={`w-full text-left px-3 py-1 text-xs rounded-xl transition ${
                            playbackRate === rate
                              ? 'bg-white text-black font-semibold'
                              : 'text-zinc-300 hover:bg-white/10'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtitles Button */}
                <button
                  onClick={onOpenSubtitles}
                  className={`p-2 rounded-full border transition ${
                    subtitleSettings.activeTrackId
                      ? 'bg-[#5eead4]/10 border-[#5eead4]/40 text-[#5eead4]'
                      : 'bg-white/10 border-white/10 text-zinc-300 hover:text-white hover:bg-white/15'
                  }`}
                  title="Subtitle Settings"
                >
                  <Subtitles className="w-4 h-4" />
                </button>

                {/* Watch Party Button */}
                <button
                  onClick={onOpenConnect}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    isConnected
                      ? 'bg-[#5eead4]/10 border border-[#5eead4]/40 text-[#5eead4]'
                      : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                  title="Watch Party Connection"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {isConnected ? 'Party' : 'Party'}
                  </span>
                </button>

                {/* Chat Toggle Button */}
                <button
                  onClick={onToggleChat}
                  className={`relative p-2 rounded-full border transition ${
                    isChatOpen
                      ? 'bg-[#5eead4]/20 border-[#5eead4]/40 text-[#5eead4]'
                      : 'bg-white/10 border-white/10 text-zinc-300 hover:text-white hover:bg-white/15'
                  }`}
                  title="Toggle Chat (C)"
                >
                  <MessageSquare className="w-4 h-4" />
                  {unreadCount > 0 && !isChatOpen && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#5eead4] ring-2 ring-[#121314]" />
                  )}
                </button>

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-zinc-300 hover:text-white rounded-full hover:bg-white/10 transition"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4" />
                  ) : (
                    <Maximize className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlays rendered inside the fullscreen player layer */}
      {children}
    </div>
  );
}
