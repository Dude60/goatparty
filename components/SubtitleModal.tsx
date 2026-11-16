'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  Subtitles,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Type,
  Sliders,
  Palette,
  Eye,
  Search,
  Globe,
  Download,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { SubtitleSettings, SubtitleTrack } from '@/types/watch-party';
import { parseSubtitles } from '@/utils/subtitleParser';

interface SubtitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFileName?: string | null;
  tracks: SubtitleTrack[];
  onAddTrack: (track: SubtitleTrack) => void;
  settings: SubtitleSettings;
  onUpdateSettings: (newSettings: Partial<SubtitleSettings>) => void;
}

interface OnlineSubResult {
  id: string;
  releaseName: string;
  languageName: string;
  downloads: number;
  zipDownloadLink: string;
  subFormat: string;
}

const COLOR_SWATCHES = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Mint Teal', value: '#5EEAD4' },
  { name: 'Yellow', value: '#FACC15' },
  { name: 'Cyan', value: '#38BDF8' },
  { name: 'Rose', value: '#FB7185' },
];

const FONT_FAMILIES = [
  { label: 'Sans-Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Modern / Display', value: '"Trebuchet MS", "Lucida Grande", sans-serif' },
];

const ONLINE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'tr', label: 'Turkish (Türkçe)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'it', label: 'Italian (Italiano)' },
];

function cleanMovieFileName(fileName?: string | null): string {
  if (!fileName) return '';

  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[._\-+]/g, ' ')
    .replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(
      /\b(1080p|720p|2160p|4k|uhd|bluray|blu-ray|bdrip|brrip|web-dl|webrip|web|hdrip|dvdrip|x264|x265|h264|h265|hevc|aac|ac3|dts|dd5\.1|atmos|repack|proper|yify|yts|rarbg|eztv|galaxyrg|flux|tbs)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export default function SubtitleModal({
  isOpen,
  onClose,
  videoFileName,
  tracks,
  onAddTrack,
  settings,
  onUpdateSettings,
}: SubtitleModalProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'online'>('online');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Online Subs state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [searchResults, setSearchResults] = useState<OnlineSubResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSubId, setLoadingSubId] = useState<string | null>(null);
  const [loadedSubId, setLoadedSubId] = useState<string | null>(null);
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

  // Sync settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('goatparty_subtitle_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save subtitle settings to localStorage', e);
    }
  }, [settings]);

  // Pre-fill clean movie name in search box when video changes or modal opens
  useEffect(() => {
    if (isOpen && videoFileName) {
      const cleaned = cleanMovieFileName(videoFileName);
      if (cleaned && !searchQuery) {
        setSearchQuery(cleaned);
      }
    }
  }, [isOpen, videoFileName, searchQuery]);

  const handleSearchOnlineSubs = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/subtitles?query=${encodeURIComponent(searchQuery.trim())}&language=${encodeURIComponent(selectedLanguage)}`
      );

      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setSearchResults(data.results || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(`Failed to fetch online subtitles: ${msg}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedLanguage]);

  const handleDownloadAndAddSub = async (sub: OnlineSubResult) => {
    setLoadingSubId(sub.id);
    setSearchError(null);

    try {
      const res = await fetch('/api/subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zipDownloadLink: sub.zipDownloadLink,
          language: selectedLanguage,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Download failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.srtText) {
        throw new Error('No subtitle text returned');
      }

      const cues = parseSubtitles(data.srtText);
      if (cues.length === 0) {
        throw new Error('Could not parse any subtitle cues from downloaded file');
      }

      const trackId = `online_${sub.id}_${Date.now()}`;
      const newTrack: SubtitleTrack = {
        id: trackId,
        label: `[${sub.languageName}] ${sub.releaseName.slice(0, 36)}`,
        language: sub.languageName,
        cues,
        isCustom: true,
      };

      onAddTrack(newTrack);
      onUpdateSettings({ activeTrackId: trackId });
      setLoadedSubId(sub.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(`Failed to load subtitle: ${msg}`);
    } finally {
      setLoadingSubId(null);
    }
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    try {
      const text = await file.text();
      const cues = parseSubtitles(text);

      if (cues.length === 0) {
        setUploadError('No valid subtitle cues found in file. Supported formats: .srt, .vtt');
        return;
      }

      const trackId = `track_${Date.now()}`;
      const newTrack: SubtitleTrack = {
        id: trackId,
        label: file.name.replace(/\.(srt|vtt)$/i, ''),
        language: 'Custom',
        cues,
        isCustom: true,
      };

      onAddTrack(newTrack);
      onUpdateSettings({ activeTrackId: trackId });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setUploadError(`Failed to load subtitle file: ${errorMsg}`);
    }
  };

  const adjustOffset = (delta: number) => {
    const current = settings.offsetSeconds;
    const updated = Math.min(10, Math.max(-10, parseFloat((current + delta).toFixed(2))));
    onUpdateSettings({ offsetSeconds: updated });
  };

  const getEdgeStyleCss = () => {
    switch (settings.edgeStyle) {
      case 'outline':
        return {
          textShadow:
            '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0px 2px 4px rgba(0,0,0,0.8)',
        };
      case 'drop-shadow':
        return {
          textShadow: '2px 3px 5px rgba(0, 0, 0, 0.9), 0px 1px 2px rgba(0, 0, 0, 0.8)',
        };
      case 'none':
      default:
        return {};
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#121314]/65 backdrop-blur-xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121314]/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/25">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                Subtitle Studio
              </h2>
              <p className="text-xs text-zinc-300">
                Keyless online subtitle search, timing offset sync & live styling
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

        {/* Top Tab Bar: Online Subs vs Appearance & Local */}
        <div className="px-6 pt-3 pb-2 bg-[#121314]/40 border-b border-white/10 flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('online')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 ${
              activeTab === 'online'
                ? 'bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/30'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Online Subs</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 ${
              activeTab === 'appearance'
                ? 'bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/30'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Appearance & Local</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: ONLINE SUBS */}
          {activeTab === 'online' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Search Bar & Language Selector */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    placeholder="Search movie title (e.g. Inception 2010)..."
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchOnlineSubs();
                    }}
                    className="w-full bg-black/35 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-[#5eead4] transition"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="bg-black/35 border border-white/10 rounded-2xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#5eead4]"
                  >
                    {ONLINE_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-[#121314] text-white">
                        {lang.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleSearchOnlineSubs}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200 disabled:opacity-40 flex items-center space-x-1.5 shrink-0"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-2xl text-rose-200 text-xs">
                  {searchError}
                </div>
              )}

              {/* Search Results List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-semibold text-white">Subtitles Found</span>
                  <span>{searchResults.length} matches</span>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {isSearching ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2 text-zinc-300">
                      <Loader2 className="w-6 h-6 animate-spin text-[#5eead4]" />
                      <span className="text-xs">Searching OpenSubtitles repository...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((sub) => {
                      const isLoaded = loadedSubId === sub.id;
                      const isLoading = loadingSubId === sub.id;

                      return (
                        <div
                          key={sub.id}
                          className="p-3 rounded-2xl bg-black/35 border border-white/10 hover:border-white/20 transition flex items-center justify-between gap-3"
                        >
                          <div className="overflow-hidden flex-1 space-y-1">
                            <div className="text-xs text-white font-medium truncate">
                              {sub.releaseName}
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-zinc-300">
                              <span className="px-1.5 py-0.5 rounded-md bg-[#5eead4]/15 text-[#5eead4] uppercase font-bold border border-[#5eead4]/30">
                                {sub.languageName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-200 uppercase">
                                {sub.subFormat}
                              </span>
                              <span className="flex items-center space-x-1 text-zinc-400">
                                <Download className="w-3 h-3 text-zinc-400" />
                                <span>{sub.downloads.toLocaleString()} downloads</span>
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDownloadAndAddSub(sub)}
                            disabled={isLoading}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition shrink-0 flex items-center space-x-1.5 ${
                              isLoaded
                                ? 'bg-[#5eead4]/25 border border-[#5eead4]/50 text-[#5eead4]'
                                : 'bg-white text-black hover:bg-zinc-200'
                            }`}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Loading...</span>
                              </>
                            ) : isLoaded ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#5eead4]" />
                                <span>Loaded</span>
                              </>
                            ) : (
                              <span>Add</span>
                            )}
                          </button>
                        </div>
                      );
                    })
                  ) : hasSearched ? (
                    <div className="py-10 text-center text-zinc-400 text-xs">
                      No matching subtitles found. Try a simplified movie title or change language.
                    </div>
                  ) : (
                    <div className="py-10 text-center text-zinc-400 space-y-1">
                      <Globe className="w-8 h-8 mx-auto text-zinc-500 mb-2" />
                      <p className="text-xs text-zinc-300">
                        Search across millions of subtitles without an account or API key.
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Type a movie name above and click Search.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE & LOCAL */}
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in">
              {uploadError && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-2xl text-rose-200 text-xs">
                  {uploadError}
                </div>
              )}

              {/* Track Selection & Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200">Active Subtitle Track</label>
                  <select
                    value={settings.activeTrackId || ''}
                    onChange={(e) =>
                      onUpdateSettings({ activeTrackId: e.target.value || null })
                    }
                    className="w-full bg-black/35 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#5eead4]"
                  >
                    <option value="" className="bg-[#121314] text-white">Off (No subtitles)</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#121314] text-white">
                        {t.label} ({t.cues.length} cues)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200">Upload Local File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt,.vtt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="subtitle-file-input"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-zinc-100 text-xs font-medium transition flex items-center justify-center space-x-2 border border-white/10"
                  >
                    <Upload className="w-4 h-4 text-[#5eead4]" />
                    <span>Upload .SRT or .VTT</span>
                  </button>
                </div>
              </div>

              {/* Timing Offset Sync Delay */}
              <div className="p-4 bg-black/35 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                    <Sliders className="w-4 h-4 text-[#5eead4]" />
                    <span>Timing Offset Sync Delay</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-[#5eead4] bg-[#5eead4]/15 px-2.5 py-0.5 rounded-full border border-[#5eead4]/30">
                    {settings.offsetSeconds >= 0
                      ? `+${settings.offsetSeconds.toFixed(1)}s`
                      : `${settings.offsetSeconds.toFixed(1)}s`}
                  </span>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    onClick={() => adjustOffset(-0.5)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-zinc-200 font-mono transition"
                  >
                    -0.5s
                  </button>
                  <button
                    onClick={() => adjustOffset(-0.1)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 transition"
                    title="-0.1s"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={settings.offsetSeconds}
                    onChange={(e) =>
                      onUpdateSettings({ offsetSeconds: parseFloat(e.target.value) })
                    }
                    className="flex-1 accent-[#5eead4] cursor-pointer"
                  />

                  <button
                    onClick={() => adjustOffset(0.1)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 transition"
                    title="+0.1s"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => adjustOffset(0.5)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-zinc-200 font-mono transition"
                  >
                    +0.5s
                  </button>

                  <button
                    onClick={() => onUpdateSettings({ offsetSeconds: 0 })}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition"
                    title="Reset to 0s"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Shift subtitles earlier (negative) or later (positive) to align perfectly with speech.
                </p>
              </div>

              {/* Typography & Appearance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                    <Type className="w-4 h-4 text-[#5eead4]" />
                    <span>Font Family</span>
                  </label>
                  <select
                    value={settings.fontFamily}
                    onChange={(e) => onUpdateSettings({ fontFamily: e.target.value })}
                    className="w-full bg-black/35 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#5eead4]"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.label} value={f.value} className="bg-[#121314] text-white">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-zinc-200">
                    <span>Font Size</span>
                    <span className="font-mono text-zinc-300">{settings.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="48"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) =>
                      onUpdateSettings({ fontSize: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-[#5eead4] cursor-pointer mt-2"
                  />
                </div>
              </div>

              {/* Color & Edge Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                    <Palette className="w-4 h-4 text-[#5eead4]" />
                    <span>Text Color</span>
                  </label>
                  <div className="flex items-center space-x-2 pt-1">
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.value}
                        onClick={() => onUpdateSettings({ textColor: swatch.value })}
                        className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition ${
                          settings.textColor.toLowerCase() === swatch.value.toLowerCase()
                            ? 'border-[#5eead4] scale-110'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                        style={{ backgroundColor: swatch.value }}
                        title={swatch.name}
                      >
                        {settings.textColor.toLowerCase() === swatch.value.toLowerCase() && (
                          <Check
                            className={`w-4 h-4 ${
                              swatch.value === '#FFFFFF' ||
                              swatch.value === '#FACC15' ||
                              swatch.value === '#5EEAD4'
                                ? 'text-black'
                                : 'text-white'
                            }`}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200">Edge Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['outline', 'drop-shadow', 'none'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => onUpdateSettings({ edgeStyle: style })}
                        className={`py-2 px-2 text-xs rounded-xl border capitalize font-medium transition ${
                          settings.edgeStyle === style
                            ? 'bg-[#5eead4]/15 text-[#5eead4] border-[#5eead4]/40'
                            : 'bg-black/35 text-zinc-300 border-white/5 hover:border-white/20'
                        }`}
                      >
                        {style === 'drop-shadow' ? 'Shadow' : style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Background Opacity & Vertical Position */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-zinc-200">
                    <span>Background Box Opacity</span>
                    <span className="font-mono text-zinc-300">
                      {Math.round(settings.backgroundOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.backgroundOpacity}
                    onChange={(e) =>
                      onUpdateSettings({ backgroundOpacity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#5eead4] cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-zinc-200">
                    <span>Position from Bottom</span>
                    <span className="font-mono text-zinc-300">{settings.verticalPosition}%</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="40"
                    step="1"
                    value={settings.verticalPosition}
                    onChange={(e) =>
                      onUpdateSettings({ verticalPosition: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-[#5eead4] cursor-pointer"
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                  <Eye className="w-4 h-4 text-[#5eead4]" />
                  <span>Live Preview</span>
                </label>
                <div className="relative w-full h-28 rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center p-4">
                  <div
                    className="text-center transition-all select-none px-3.5 py-1.5 rounded-lg inline-block max-w-[90%]"
                    style={{
                      fontFamily: settings.fontFamily,
                      fontSize: `${Math.min(settings.fontSize, 26)}px`,
                      color: settings.textColor,
                      backgroundColor: `rgba(0, 0, 0, ${settings.backgroundOpacity})`,
                      ...getEdgeStyleCss(),
                    }}
                  >
                    goatparty: PrimeVision P2P Watch Party
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121314]/40 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-zinc-300">
            {activeTab === 'online'
              ? 'Keyless search powered by OpenSubtitles'
              : 'Settings auto-saved to browser'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-zinc-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (mountTarget) {
    return createPortal(modalContent, mountTarget);
  }

  return modalContent;
}
