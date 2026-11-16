'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film,
  Subtitles,
  MessageSquare,
  Sparkles,
  Info,
  Users,
  Volume2,
  Copy,
  Check,
  X,
  Share2,
} from 'lucide-react';
import {
  SubtitleSettings,
  SubtitleTrack,
  ChatMessage,
  SyncMessage,
  FloatingReaction,
} from '@/types/watch-party';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { getSavedUsername, saveUsername } from '@/utils/usernameGenerator';
import VideoStage from '@/components/VideoStage';
import ConnectModal from '@/components/ConnectModal';
import SubtitleModal from '@/components/SubtitleModal';
import FloatingChat from '@/components/FloatingChat';
import GoatLogo from '@/components/GoatLogo';

const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  activeTrackId: null,
  offsetSeconds: 0,
  fontSize: 24,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  textColor: '#FFFFFF',
  edgeStyle: 'drop-shadow',
  backgroundOpacity: 0.35,
  verticalPosition: 8,
};

export default function GoatPartyPage() {
  // User Profile
  const [username, setUsername] = useState<string>('AlpineGoat42');

  // Video State
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoFileSize, setVideoFileSize] = useState<number | undefined>(undefined);

  // Subtitle State
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS);

  // Chat & Reaction State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // Peer State
  const [peerFileName, setPeerFileName] = useState<string | undefined>(undefined);
  const [peerFileSize, setPeerFileSize] = useState<number | undefined>(undefined);

  // Modals
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);
  const [connectModalTab, setConnectModalTab] = useState<'host' | 'guest'>('host');
  const [guestAutoRoomId, setGuestAutoRoomId] = useState<string>('');
  const [isSubtitleOpen, setIsSubtitleOpen] = useState<boolean>(false);
  const [isAudioHelpOpen, setIsAudioHelpOpen] = useState<boolean>(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);
  const [copiedFfmpegModal, setCopiedFfmpegModal] = useState<boolean>(false);

  // Ref for previous video object URL
  const prevVideoUrlRef = useRef<string | null>(null);

  // Load saved username & subtitle preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = getSavedUsername();
      setUsername(savedUser);

      const savedSubtitles = localStorage.getItem('goatparty_subtitle_settings');
      if (savedSubtitles) {
        setSubtitleSettings((prev) => ({
          ...prev,
          ...JSON.parse(savedSubtitles),
          activeTrackId: null,
        }));
      }
    } catch (e) {
      console.error('Failed to parse settings from localStorage', e);
    }
  }, []);

  // Update Username Handler
  const handleUpdateUsername = useCallback((newName: string) => {
    saveUsername(newName);
    setUsername(newName);
  }, []);

  // Add floating reaction helper
  const triggerFloatingReaction = useCallback((emoji: string, senderLabel?: string) => {
    const id = `reaction_${Date.now()}_${Math.random()}`;
    const leftPercent = Math.floor(Math.random() * 60) + 20;
    const bottomOffset = Math.floor(Math.random() * 15) + 14;

    setFloatingReactions((prev) => [
      ...prev,
      { id, emoji, username: senderLabel, leftPercent, bottomOffset },
    ]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2800);
  }, []);

  // Last incoming sync message for VideoStage
  const [lastIncomingSyncMessage, setLastIncomingSyncMessage] = useState<SyncMessage | null>(null);

  // Handle messages received over PeerJS DataConnection
  const handleIncomingMessage = useCallback(
    (msg: SyncMessage) => {
      switch (msg.type) {
        case 'chat':
          if (msg.text) {
            const senderDisplayName = msg.username || msg.senderName || 'Peer';
            setChatMessages((prev) => [
              ...prev,
              {
                id: `msg_${Date.now()}_${Math.random()}`,
                sender: 'peer',
                senderName: senderDisplayName,
                username: senderDisplayName,
                text: msg.text || '',
                timestamp: msg.timestamp || Date.now(),
              },
            ]);
            if (!isChatOpen) {
              setUnreadCount((c) => c + 1);
            }
          }
          break;

        case 'reaction':
          if (msg.emoji) {
            triggerFloatingReaction(msg.emoji, msg.username || msg.senderName);
          }
          break;

        case 'file-info':
          if (msg.fileName) {
            setPeerFileName(msg.fileName);
            setPeerFileSize(msg.fileSize);
            setChatMessages((prev) => [
              ...prev,
              {
                id: `sys_${Date.now()}`,
                sender: 'system',
                text: `Peer loaded: "${msg.fileName}"`,
                timestamp: Date.now(),
              },
            ]);
          }
          break;

        case 'play':
        case 'pause':
        case 'seek':
        case 'rate':
        case 'heartbeat':
          setLastIncomingSyncMessage(msg);
          break;

        default:
          break;
      }
    },
    [isChatOpen, triggerFloatingReaction]
  );

  // Initialize PeerJS Room hook
  const {
    status: connectionStatus,
    isConnected,
    role,
    roomId,
    errorMessage: peerError,
    hostRoom,
    joinRoom,
    sendMessage: sendPeerMessage,
    disconnect,
  } = usePeerRoom(handleIncomingMessage);

  // 1-Step Auto-Join handling when opening ?room=... URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
      setConnectModalTab('guest');
      setGuestAutoRoomId(roomParam);
      setIsConnectOpen(true);

      // Join immediately in 1 step!
      joinRoom(roomParam);

      // Clean the query string without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [joinRoom]);

  // Keyboard shortcut listener: 'C' key toggles floating chatbox
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
      if (e.code === 'KeyC') {
        e.preventDefault();
        setIsChatOpen((prev) => {
          if (!prev) setUnreadCount(0);
          return !prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Notify peer of our file info whenever we connect or our file changes
  useEffect(() => {
    if (isConnected && videoFileName) {
      sendPeerMessage({
        type: 'file-info',
        fileName: videoFileName,
        fileSize: videoFileSize,
        username: username,
      });
    }
  }, [isConnected, videoFileName, videoFileSize, username, sendPeerMessage]);

  // Video File Selection
  const handleSelectVideo = useCallback(
    (file: File) => {
      if (prevVideoUrlRef.current) {
        URL.revokeObjectURL(prevVideoUrlRef.current);
      }

      const url = URL.createObjectURL(file);
      prevVideoUrlRef.current = url;

      setVideoSrc(url);
      setVideoFileName(file.name);
      setVideoFileSize(file.size);

      setChatMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          sender: 'system',
          text: `You loaded: "${file.name}"`,
          timestamp: Date.now(),
        },
      ]);

      if (isConnected) {
        sendPeerMessage({
          type: 'file-info',
          fileName: file.name,
          fileSize: file.size,
          username: username,
        });
      }
    },
    [isConnected, username, sendPeerMessage]
  );

  // Send Chat Message
  const handleSendChatMessage = useCallback(
    (text: string) => {
      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        sender: 'me',
        senderName: username,
        username: username,
        text,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, newMsg]);

      sendPeerMessage({
        type: 'chat',
        text,
        senderName: username,
        username: username,
        timestamp: Date.now(),
      });
    },
    [username, sendPeerMessage]
  );

  // Send Emoji Reaction
  const handleSendReaction = useCallback(
    (emoji: string) => {
      triggerFloatingReaction(emoji, username);
      sendPeerMessage({
        type: 'reaction',
        emoji,
        senderName: username,
        username: username,
      });
    },
    [username, triggerFloatingReaction, sendPeerMessage]
  );

  // Subtitle Handlers
  const handleAddSubtitleTrack = useCallback((track: SubtitleTrack) => {
    setSubtitleTracks((prev) => [...prev, track]);
  }, []);

  const handleUpdateSubtitleSettings = useCallback(
    (newSettings: Partial<SubtitleSettings>) => {
      setSubtitleSettings((prev) => ({ ...prev, ...newSettings }));
    },
    []
  );

  const handleOpenConnectModal = (tab: 'host' | 'guest' = 'host') => {
    setConnectModalTab(tab);
    setIsConnectOpen(true);
    if (tab === 'host' && !roomId) {
      hostRoom();
    }
  };

  const copyModalFfmpeg = () => {
    const cmd = `ffmpeg -i "${videoFileName || 'movie.mkv'}" -c:v copy -c:a aac output.mp4`;
    navigator.clipboard.writeText(cmd);
    setCopiedFfmpegModal(true);
    setTimeout(() => setCopiedFfmpegModal(false), 2500);
  };

  return (
    <div className="flex h-screen w-screen bg-[#121314] text-zinc-100 overflow-hidden font-sans">
      {/* Left Navigation Rail */}
      <nav className="w-16 md:w-20 bg-[#121314] border-r border-white/5 flex flex-col items-center py-5 justify-between shrink-0 z-30 select-none">
        {/* Brand Logo */}
        <div className="flex flex-col items-center space-y-6">
          <div className="w-11 h-11 rounded-2xl bg-[#1e1f23] border border-[#5eead4]/40 flex items-center justify-center p-1.5">
            <GoatLogo className="w-full h-full" />
          </div>

          {/* Navigation Item Icons */}
          <div className="flex flex-col space-y-4">
            {/* Watch Room / Home */}
            <button
              onClick={() => handleOpenConnectModal('host')}
              className={`p-3 rounded-2xl transition group relative ${
                isConnected
                  ? 'bg-[#5eead4]/10 text-[#5eead4] border border-[#5eead4]/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              title="Watch Party"
            >
              <Users className="w-5 h-5" />
              {isConnected && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#5eead4] animate-pulse" />
              )}
            </button>

            {/* Subtitles Studio */}
            <button
              onClick={() => setIsSubtitleOpen(true)}
              className={`p-3 rounded-2xl transition group relative ${
                subtitleSettings.activeTrackId
                  ? 'bg-[#5eead4]/10 text-[#5eead4] border border-[#5eead4]/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              title="Subtitle Studio"
            >
              <Subtitles className="w-5 h-5" />
            </button>

            {/* Floating Chat Toggle */}
            <button
              onClick={() =>
                setIsChatOpen((prev) => {
                  if (!prev) setUnreadCount(0);
                  return !prev;
                })
              }
              className={`p-3 rounded-2xl transition relative ${
                isChatOpen
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              title="Toggle Floating Chat (C)"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && !isChatOpen && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#5eead4] ring-2 ring-[#121314]" />
              )}
            </button>

            {/* Audio Help / No-Sound Guide */}
            <button
              onClick={() => setIsAudioHelpOpen(true)}
              className="p-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/5 transition"
              title="Audio Help / No-Sound Guide"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Help / About */}
        <button
          onClick={() => setIsHowItWorksOpen(true)}
          className="p-3 rounded-2xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition"
          title="About goatparty"
        >
          <Info className="w-5 h-5" />
        </button>
      </nav>

      {/* Main Streaming Canvas Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Sleek Top Header Bar */}
        <header className="h-14 bg-[#121314]/80 backdrop-blur-md border-b border-white/5 px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5">
              <GoatLogo className="w-6 h-6" />
              <h1 className="text-base font-bold tracking-tight text-white flex items-center space-x-2">
                <span>goatparty</span>
                <span className="text-[10px] uppercase font-bold text-[#5eead4] bg-[#5eead4]/10 px-2 py-0.5 rounded-full border border-[#5eead4]/20 tracking-wider">
                  P2P Sync
                </span>
              </h1>
            </div>

            {/* Video File Indicator */}
            {videoFileName && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                <Film className="w-3.5 h-3.5 text-[#5eead4]" />
                <span className="truncate max-w-[200px] text-zinc-200">{videoFileName}</span>
                <label
                  htmlFor="change-video-file-top"
                  className="text-[10px] text-zinc-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded-full hover:bg-white/10 transition"
                >
                  Change
                </label>
                <input
                  id="change-video-file-top"
                  type="file"
                  accept="video/*,.mkv,.mp4,.webm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectVideo(f);
                  }}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center space-x-3">
            {/* Watch Party Button */}
            <button
              onClick={() => handleOpenConnectModal('host')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center space-x-2 ${
                isConnected
                  ? 'bg-[#5eead4]/10 border border-[#5eead4]/40 text-[#5eead4]'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
              title="Watch Party Connection"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>
                {isConnected ? 'Watch Party • Connected' : 'Watch Party'}
              </span>
            </button>
          </div>
        </header>

        {/* Full-Width Video Stage */}
        <main className="flex-1 relative flex overflow-hidden">
          <VideoStage
            isConnected={isConnected}
            videoSrc={videoSrc}
            videoFileName={videoFileName}
            onSelectVideo={handleSelectVideo}
            subtitleSettings={subtitleSettings}
            subtitleTracks={subtitleTracks}
            onOpenSubtitles={() => setIsSubtitleOpen(true)}
            onOpenConnect={() => handleOpenConnectModal('host')}
            onToggleChat={() =>
              setIsChatOpen((prev) => {
                if (!prev) setUnreadCount(0);
                return !prev;
              })
            }
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
            floatingReactions={floatingReactions}
            onBroadcastMessage={sendPeerMessage}
            lastIncomingMessage={lastIncomingSyncMessage}
          >
            {/* Hideable Transparent Floating Glassmorphic Chatbox inside the fullscreen player layer */}
            <FloatingChat
              messages={chatMessages}
              currentUsername={username}
              onChangeUsername={handleUpdateUsername}
              onSendMessage={handleSendChatMessage}
              onSendReaction={handleSendReaction}
              peerFileName={peerFileName}
              peerFileSize={peerFileSize}
              myFileName={videoFileName || undefined}
              isConnected={isConnected}
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />
          </VideoStage>
        </main>
      </div>

      {/* 1-Step PeerJS Room Connection Modal */}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        isConnected={isConnected}
        status={connectionStatus}
        role={role}
        roomId={roomId}
        errorMessage={peerError}
        initialTab={connectModalTab}
        initialRoomId={guestAutoRoomId}
        onHostRoom={hostRoom}
        onJoinRoom={joinRoom}
        onDisconnect={disconnect}
      />

      {/* Subtitles Customization & Sync Modal */}
      <SubtitleModal
        isOpen={isSubtitleOpen}
        onClose={() => setIsSubtitleOpen(false)}
        videoFileName={videoFileName}
        tracks={subtitleTracks}
        onAddTrack={handleAddSubtitleTrack}
        settings={subtitleSettings}
        onUpdateSettings={handleUpdateSubtitleSettings}
      />

      {/* Audio Help Modal (.MKV AC3/DTS Fix) */}
      {isAudioHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#121314]/65 backdrop-blur-xl border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Audio Help / No-Sound Guide</h3>
                  <p className="text-xs text-zinc-300">Fixing silent AC3/EAC3/DTS audio in video files</p>
                </div>
              </div>
              <button
                onClick={() => setIsAudioHelpOpen(false)}
                className="p-2 text-zinc-300 hover:text-white rounded-full hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-200 leading-relaxed">
              <p>
                Web browsers natively support video playback in MP4, MKV, and WebM, but <strong>mute or drop AC3, EAC3, and DTS surround audio tracks</strong> due to browser codec licensing restrictions.
              </p>
              <div className="p-3.5 bg-black/35 rounded-2xl border border-white/10 space-y-2">
                <span className="font-semibold text-[#5eead4]">The 5-Second Lossless Fix:</span>
                <p className="text-zinc-300 text-[11px]">
                  Convert only the audio track to standard AAC using FFmpeg without re-encoding video:
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <code className="text-[10px] font-mono bg-black/60 px-3 py-1.5 rounded-xl text-emerald-300 border border-white/10 flex-1 truncate select-all">
                    ffmpeg -i &quot;{videoFileName || 'movie.mkv'}&quot; -c:v copy -c:a aac output.mp4
                  </code>
                  <button
                    onClick={copyModalFfmpeg}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition flex items-center space-x-1 shrink-0 border border-white/10"
                  >
                    {copiedFfmpegModal ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#5eead4]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAudioHelpOpen(false)}
              className="w-full py-3 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* How it works modal */}
      {isHowItWorksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#121314]/65 backdrop-blur-xl border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-2xl bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/25">
                  <Sparkles className="w-5 h-5 text-[#5eead4]" />
                </div>
                <h3 className="font-semibold text-white text-base">goatparty P2P Sync</h3>
              </div>
              <button
                onClick={() => setIsHowItWorksOpen(false)}
                className="p-2 text-zinc-300 hover:text-white rounded-full hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-200 leading-relaxed">
              <div className="p-3.5 bg-black/35 rounded-2xl border border-white/10">
                <span className="font-semibold text-[#5eead4]">1. 1-Step Room Joining:</span>
                <p className="mt-1 text-zinc-300">
                  Host generates a 1-line Room ID and shares the link. Guest opens the link and connects in a single step without sending any reply code back!
                </p>
              </div>

              <div className="p-3.5 bg-black/35 rounded-2xl border border-white/10">
                <span className="font-semibold text-white">2. Zero React Re-render Stutter:</span>
                <p className="mt-1 text-zinc-300">
                  Scrubber bar and timestamps update directly via DOM references with zero re-renders per frame, and 8-second heartbeats prevent hardware decoder interruption.
                </p>
              </div>

              <div className="p-3.5 bg-black/35 rounded-2xl border border-white/10">
                <span className="font-semibold text-[#5eead4]">3. Zero Server Video Upload:</span>
                <p className="mt-1 text-zinc-300">
                  Movies play locally from both users&apos; disks. Only play, pause, seek, and emoji events travel peer-to-peer over the DataConnection.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHowItWorksOpen(false)}
              className="w-full py-3 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
