import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'eng',
  eng: 'eng',
  ar: 'ara',
  ara: 'ara',
  fr: 'fre',
  fre: 'fre',
  es: 'spa',
  spa: 'spa',
  de: 'ger',
  ger: 'ger',
  tr: 'tur',
  tur: 'tur',
  pt: 'por',
  por: 'por',
  it: 'ita',
  ita: 'ita',
};

// GET /api/subtitles?query=...&language=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();
    const rawLang = searchParams.get('language')?.toLowerCase().trim() || 'en';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const subLangId = LANGUAGE_CODE_MAP[rawLang] || rawLang || 'eng';
    const opensubtitlesUrl = `https://rest.opensubtitles.org/search/query-${encodeURIComponent(query)}/sublanguageid-${subLangId}`;

    const res = await fetch(opensubtitlesUrl, {
      headers: {
        'User-Agent': 'TemporaryUserAgent',
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenSubtitles API responded with status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      return NextResponse.json({ results: [] });
    }

    const results = data
      .filter((item: any) => item && item.ZipDownloadLink)
      .map((item: any) => ({
        id: String(item.IDSubtitleFile || item.IDSubtitle || Math.random()),
        releaseName: item.MovieReleaseName || item.SubFileName || item.MovieName || 'Subtitle Release',
        languageName: item.LanguageName || 'Unknown',
        downloads: parseInt(item.SubDownloadsCnt, 10) || 0,
        zipDownloadLink: item.ZipDownloadLink,
        subFormat: (item.SubFormat || 'srt').toLowerCase(),
      }))
      .sort((a, b) => b.downloads - a.downloads);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    console.error('Error searching subtitles:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to search subtitles: ${msg}` }, { status: 500 });
  }
}

// POST /api/subtitles body: { zipDownloadLink, language }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zipDownloadLink, language } = body;

    if (!zipDownloadLink) {
      return NextResponse.json({ error: 'zipDownloadLink is required' }, { status: 400 });
    }

    const res = await fetch(zipDownloadLink, {
      headers: {
        'User-Agent': 'TemporaryUserAgent',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to download subtitle zip (status ${res.status})` },
        { status: res.status }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let targetFileEntry: JSZip.JSZipObject | null = null;
    let targetFileName = '';

    // Search for .srt or .vtt file
    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const lower = filename.toLowerCase();
      if (lower.endsWith('.srt') || lower.endsWith('.vtt')) {
        targetFileEntry = file;
        targetFileName = filename;
        break;
      }
    }

    // Fallback: search for any non-metadata file
    if (!targetFileEntry) {
      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        const lower = filename.toLowerCase();
        if (!lower.endsWith('.nfo') && !lower.endsWith('.txt')) {
          targetFileEntry = file;
          targetFileName = filename;
          break;
        }
      }
    }

    if (!targetFileEntry) {
      return NextResponse.json(
        { error: 'No valid subtitle file (.srt or .vtt) found inside archive' },
        { status: 404 }
      );
    }

    const bytes = await targetFileEntry.async('uint8array');

    // Decode text safely with encoding fallback
    let srtText = '';
    const lang = (language || '').toLowerCase();

    // If language is Arabic, prefer windows-1256 if UTF-8 fails
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      srtText = utf8Decoder.decode(bytes);
    } catch {
      try {
        if (lang === 'ar' || lang === 'ara') {
          const win1256Decoder = new TextDecoder('windows-1256');
          srtText = win1256Decoder.decode(bytes);
        } else {
          const latin1Decoder = new TextDecoder('iso-8859-1');
          srtText = latin1Decoder.decode(bytes);
        }
      } catch {
        const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
        srtText = fallbackDecoder.decode(bytes);
      }
    }

    return NextResponse.json({
      srtText,
      fileName: targetFileName,
    });
  } catch (err: unknown) {
    console.error('Error extracting subtitle archive:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to extract subtitles: ${msg}` }, { status: 500 });
  }
}
