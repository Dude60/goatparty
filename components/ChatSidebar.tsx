'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  MessageSquare,
  FileVideo,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Smile,
  Film,
} from 'lucide-react';
import { ChatMessage } from '@/types/watch-party';

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  peerFileName?: string;
  peerFileSize?: number;
  myFileName?: string;
  isConnected: boolean;
  isOpen: boolean;
  onToggle: () => void;
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

export default function ChatSidebar({
  messages,
  onSendMessage,
  onSendReaction,
  peerFileName,
  peerFileSize,
  myFileName,
  isConnected,
  isOpen,
  onToggle,
}: ChatSidebarProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  // Compare file names to alert if peers might have different cuts/files
  const isFileNameMatching =
    myFileName && peerFileName && myFileName.toLowerCase() === peerFileName.toLowerCase();

  return (
    <aside
      className={`fixed top-0 right-0 bottom-0 z-30 transition-all duration-300 ease-in-out flex flex-col bg-zinc-950/95 backdrop-blur-md border-l border-zinc-800 shadow-2xl ${
        isOpen ? 'w-80 md:w-96 translate-x-0' : 'w-0 translate-x-full pointer-events-none'
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Party Chat & Info</h3>
            <span className="text-[11px] text-zinc-400">
              {isConnected ? (
                <span className="text-emerald-400 font-medium">● Connected</span>
              ) : (
                <span className="text-zinc-500">○ Disconnected</span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          title="Close Sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Peer Video Info Badge */}
      <div className="p-3 bg-zinc-900/40 border-b border-zinc-800/80">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Film className="w-3 h-3 text-violet-400" />
            <span>Peer File Status</span>
          </span>
          {peerFileName && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center space-x-1 ${
                isFileNameMatching
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {isFileNameMatching ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Files Match</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Names Differ</span>
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs">
          <FileVideo className="w-4 h-4 text-violet-400 shrink-0" />
          <div className="overflow-hidden flex-1">
            {peerFileName ? (
              <div className="truncate text-zinc-200 font-medium">
                {peerFileName}
                {peerFileSize && (
                  <span className="text-zinc-500 text-[10px] ml-1.5">
                    ({formatFileSize(peerFileSize)})
                  </span>
                )}
              </div>
            ) : isConnected ? (
              <span className="text-zinc-500 italic text-[11px]">Peer hasn&apos;t loaded video yet</span>
            ) : (
              <span className="text-zinc-500 italic text-[11px]">Connect to see peer file</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 p-6 space-y-2">
            <Smile className="w-8 h-8 text-zinc-600" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[11px] text-zinc-600">
              Send quick emojis or chat while watching together!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === 'me';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-center text-[11px] text-zinc-400 italic"
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
                <div className="flex items-center space-x-1 text-[10px] text-zinc-500 mb-0.5 px-1">
                  <span>{isMe ? 'You' : msg.senderName || 'Peer'}</span>
                  <span>•</span>
                  <span>{formatMessageTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'bg-violet-600 text-white rounded-br-xs'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-xs border border-zinc-700/60'
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

      {/* Quick Reaction Bar */}
      <div className="px-3 py-2 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          Reactions:
        </span>
        <div className="flex items-center space-x-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="p-1.5 text-base hover:scale-125 active:scale-95 rounded-lg hover:bg-zinc-800/80 transition transform duration-150"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnected ? 'Type a message...' : 'Connect to chat...'}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition shadow"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
}
