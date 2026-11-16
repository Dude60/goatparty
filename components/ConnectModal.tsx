'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  Radio,
  Users,
  Share2,
  ArrowRight,
  Wifi,
  Loader2,
  AlertCircle,
  LogOut,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import { PeerRoomStatus } from '@/hooks/usePeerRoom';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  status: PeerRoomStatus;
  role: 'host' | 'guest' | null;
  roomId: string;
  errorMessage: string | null;
  initialTab?: 'host' | 'guest';
  initialRoomId?: string;
  onHostRoom: () => Promise<string | null>;
  onJoinRoom: (roomId: string) => Promise<boolean>;
  onDisconnect: () => void;
}

export default function ConnectModal({
  isOpen,
  onClose,
  isConnected,
  status,
  role,
  roomId,
  errorMessage,
  initialTab = 'host',
  initialRoomId = '',
  onHostRoom,
  onJoinRoom,
  onDisconnect,
}: ConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'host' | 'guest'>(initialTab);
  const [guestRoomInput, setGuestRoomInput] = useState(initialRoomId);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mountTarget, setMountTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const updateTarget = () => {
        setMountTarget(document.fullscreenElement || document.body);
      };
      updateTarget();
      document.addEventListener('fullscreenchange', updateTarget);
      return () => document.removeEventListener('fullscreenchange', updateTarget);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialRoomId) {
      setGuestRoomInput(initialRoomId);
    }
  }, [initialRoomId]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!roomId || typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCreateHost = async () => {
    setIsSubmitting(true);
    await onHostRoom();
    setIsSubmitting(false);
  };

  const handleJoin = async () => {
    if (!guestRoomInput.trim()) return;
    setIsSubmitting(true);
    await onJoinRoom(guestRoomInput.trim());
    setIsSubmitting(false);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#121314]/65 backdrop-blur-xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#121314]/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/25">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                1-Step Watch Party
              </h2>
              <p className="text-xs text-zinc-300">
                Direct P2P sync • No video upload
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-300 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-3 bg-[#121314]/40 border-b border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? 'bg-[#5eead4]'
                  : status === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="text-zinc-200 font-medium">
              {isConnected ? (
                <span className="text-[#5eead4] font-semibold">
                  Connected ({role === 'host' ? 'Host' : 'Guest'})
                </span>
              ) : status === 'connecting' ? (
                'Connecting to peer...'
              ) : (
                'Not in a party'
              )}
            </span>
          </div>

          {isConnected && (
            <button
              onClick={onDisconnect}
              className="flex items-center space-x-1.5 text-rose-400 hover:text-rose-300 font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-2xl text-rose-200 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {isConnected ? (
            <div className="py-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/30 mb-2">
                <Wifi className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Party is Connected!</h3>
              <p className="text-xs text-zinc-200 max-w-sm mx-auto leading-relaxed">
                Direct WebRTC channel active. Both peers control synchronized playback,
                seek positions, and floating emoji reactions.
              </p>
              <div className="pt-2 flex justify-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200"
                >
                  Back to Cinema
                </button>
                <button
                  onClick={onDisconnect}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-rose-950/60 text-rose-400 font-medium text-xs border border-white/10 transition"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="grid grid-cols-2 p-1 bg-black/35 rounded-2xl border border-white/10">
                <button
                  onClick={() => setActiveTab('host')}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                    activeTab === 'host'
                      ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-[#5eead4]" />
                  <span>I am Hosting</span>
                </button>
                <button
                  onClick={() => setActiveTab('guest')}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                    activeTab === 'guest'
                      ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#5eead4]" />
                  <span>I am Joining (Guest)</span>
                </button>
              </div>

              {/* Host View */}
              {activeTab === 'host' && (
                <div className="space-y-4 animate-in fade-in">
                  {!roomId ? (
                    <button
                      onClick={handleCreateHost}
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-5 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200 flex items-center justify-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating Room...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span>Generate 1-Click Room</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      {/* Room Code Badge */}
                      <div className="p-4 rounded-2xl bg-black/35 border border-white/10 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-300 tracking-wider">
                            Your Room ID
                          </span>
                          <div className="text-xl font-mono font-bold text-[#5eead4] tracking-wide">
                            {roomId}
                          </div>
                        </div>
                        <button
                          onClick={handleCopyId}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-100 text-xs font-medium border border-white/10 transition flex items-center space-x-1"
                        >
                          {copiedId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#5eead4]" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy ID</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 1-Click Copy Invite Link Button */}
                      <button
                        onClick={handleCopyLink}
                        className="w-full py-3 px-5 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200 flex items-center justify-center space-x-2"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Invite Link Copied!</span>
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-4 h-4" />
                            <span>Copy 1-Click Invite Link</span>
                          </>
                        )}
                      </button>

                      <div className="text-center">
                        <div className="inline-flex items-center space-x-2 text-[11px] text-zinc-200 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span>Waiting for your friend to open the link...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Guest View */}
              {activeTab === 'guest' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-200">
                      Enter Host&apos;s Room ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. sync-abc123"
                      value={guestRoomInput}
                      onChange={(e) => setGuestRoomInput(e.target.value)}
                      className="w-full bg-black/35 border border-white/10 rounded-2xl px-4 py-3 font-mono text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-[#5eead4] transition"
                    />
                  </div>

                  <button
                    onClick={handleJoin}
                    disabled={isSubmitting || !guestRoomInput.trim()}
                    className="w-full py-3 px-5 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting to Room...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Watch Party</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (mountTarget) {
    return createPortal(modalContent, mountTarget);
  }

  return modalContent;
}
