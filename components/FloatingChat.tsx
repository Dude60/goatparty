'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  MessageSquare,
  FileVideo,
  AlertTriangle,
  CheckCircle2,
  X,
  Smile,
  Film,
  Pencil,
  Check,
} from 'lucide-react';
import { ChatMessage } from '@/types/watch-party';

interface FloatingChatProps {
  messages: ChatMessage[];
  currentUsername: string;
  onChangeUsername: (username: string) => void;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  peerFileName?: string;
  peerFileSize?: number;
  myFileName?: string;
  isConnected: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_REACTIONS = ['😂', '😱', '🔥', '❤️', '👏', '😭'];

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FloatingChat({
  messages,
  currentUsername,
  onChangeUsername,
  onSendMessage,
  onSendReaction,
  peerFileName,
  peerFileSize,
  myFileName,
  isConnected,
  isOpen,
  onClose,
}: FloatingChatProps) {
  const [inputText, setInputText] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState(currentUsername);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempUsername(currentUsername);
  }, [currentUsername]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isEditingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
      usernameInputRef.current.select();
    }
  }, [isEditingUsername]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleSaveUsername = () => {
    const trimmed = tempUsername.trim();
    if (trimmed && trimmed !== currentUsername) {
      onChangeUsername(trimmed);
    } else {
      setTempUsername(currentUsername);
    }
    setIsEditingUsername(false);
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveUsername();
    } else if (e.key === 'Escape') {
      setTempUsername(currentUsername);
      setIsEditingUsername(false);
    }
  };

  if (!isOpen) return null;

  const isFileNameMatching =
    myFileName && peerFileName && myFileName.toLowerCase() === peerFileName.toLowerCase();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="absolute bottom-24 right-4 sm:right-6 z-40 w-80 sm:w-96 max-h-[480px] flex flex-col bg-[#121314]/60 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200 select-text"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#121314]/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/25">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Party Chat</h3>
              <span className="text-[10px] text-zinc-300">
                {isConnected ? (
                  <span className="text-[#5eead4] font-medium">● Connected</span>
                ) : (
                  <span className="text-zinc-500">○ Disconnected</span>
                )}
              </span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-zinc-300 hover:text-white rounded-lg hover:bg-white/10 transition"
            title="Close Chat (C)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Username Banner with Inline Edit */}
        <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-black/35 border border-white/10 text-[11px]">
          <span className="text-zinc-300 text-[10px] uppercase font-bold tracking-wider">
            You:
          </span>

          {isEditingUsername ? (
            <div className="flex items-center space-x-1.5 flex-1 justify-end ml-2">
              <input
                ref={usernameInputRef}
                type="text"
                value={tempUsername}
                maxLength={24}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTempUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                className="bg-black/60 border border-[#5eead4]/50 rounded-lg px-2 py-0.5 text-xs text-[#5eead4] font-semibold focus:outline-none w-28 text-right"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveUsername();
                }}
                className="p-1 text-[#5eead4] hover:text-white rounded hover:bg-white/10 transition"
                title="Save username (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTempUsername(currentUsername);
                  setIsEditingUsername(false);
                }}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-[#5eead4]">{currentUsername}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingUsername(true);
                }}
                className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-white/10 transition"
                title="Edit your username"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Peer File Indicator */}
      {isConnected && (
        <div className="px-3.5 py-2 bg-black/35 border-b border-white/10 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-1.5 overflow-hidden text-zinc-200">
            <Film className="w-3.5 h-3.5 text-[#5eead4] shrink-0" />
            <span className="truncate max-w-[170px]">
              {peerFileName || 'Peer choosing video...'}
            </span>
            {peerFileSize && (
              <span className="text-[10px] text-zinc-400">({formatFileSize(peerFileSize)})</span>
            )}
          </div>

          {peerFileName && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center space-x-1 ${
                isFileNameMatching
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
              }`}
            >
              {isFileNameMatching ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Match</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Different</span>
                </>
              )}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[220px]">
        {messages.length === 0 ? (
          <div className="py-6 text-center text-zinc-400 space-y-1">
            <Smile className="w-6 h-6 mx-auto text-zinc-500" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[10px] text-zinc-500">
              React with emojis or chat while watching!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === 'me';
            const isSystem = msg.sender === 'system';
            const displayName = isMe
              ? currentUsername
              : msg.username || msg.senderName || 'Peer';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-2.5 rounded-xl bg-white/5 border border-white/10 text-center text-[10px] text-zinc-300 italic"
                >
                  {msg.text}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Username above chat bubble */}
                <div className="flex items-center space-x-1 text-[10px] text-zinc-400 mb-0.5 px-1 font-medium">
                  <span className={isMe ? 'text-[#5eead4]' : 'text-zinc-200'}>
                    {displayName}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400 text-[9px] font-normal">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-1.5 text-xs leading-relaxed break-words ${
                    isMe
                      ? 'bg-[#5eead4]/20 text-white border border-[#5eead4]/30 rounded-br-xs'
                      : 'bg-white/10 text-zinc-100 border border-white/10 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions */}
      <div className="px-3 py-1.5 bg-[#121314]/40 border-t border-white/10 flex items-center justify-between">
        <span className="text-[9px] font-semibold text-zinc-300 uppercase tracking-wider">
          React:
        </span>
        <div className="flex items-center space-x-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                onSendReaction(emoji);
              }}
              className="p-1 text-sm hover:scale-125 active:scale-95 rounded-lg hover:bg-white/10 transition transform duration-150"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="p-2.5 bg-[#121314]/50 border-t border-white/10 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputText}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnected ? 'Message watch party...' : 'Connect to chat...'}
          className="flex-1 bg-black/35 border border-white/15 rounded-full px-3.5 py-1.5 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-[#5eead4] transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition"
          title="Send"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
