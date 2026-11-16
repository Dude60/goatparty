'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import LZString from 'lz-string';
import { SyncMessage } from '@/types/watch-party';

export type ConnectionStatus =
  | 'disconnected'
  | 'generating-offer'
  | 'waiting-for-answer'
  | 'generating-answer'
  | 'connected'
  | 'error';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

const ALLOWED_SDP_PREFIXES = [
  'v=',
  'o=',
  's=',
  't=',
  'm=application',
  'c=',
  'a=ice-ufrag',
  'a=ice-pwd',
  'a=fingerprint',
  'a=setup',
  'a=mid',
  'a=sctp-port',
  'a=candidate',
];

/**
 * Strips unnecessary SDP lines to drastically reduce payload size for WebRTC DataChannel.
 */
function filterSdp(sdp: string): string {
  const filtered = sdp
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      return ALLOWED_SDP_PREFIXES.some((prefix) => line.startsWith(prefix));
    });

  return filtered.join('\r\n') + '\r\n';
}

/**
 * Strips SDP lines and compresses using LZString into a compact single-line URL-safe string.
 */
function encodeSdp(desc: RTCSessionDescriptionInit): string {
  const minifiedDesc: RTCSessionDescriptionInit = {
    type: desc.type,
    sdp: filterSdp(desc.sdp || ''),
  };
  const json = JSON.stringify(minifiedDesc);
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * Decompresses and restores RTCSessionDescriptionInit.
 */
function decodeSdp(compressed: string): RTCSessionDescriptionInit {
  const cleanStr = compressed.trim();
  const decompressed = LZString.decompressFromEncodedURIComponent(cleanStr);
  if (decompressed) {
    return JSON.parse(decompressed);
  }

  // Fallback to legacy base64 decoding if raw base64 is passed
  const json = decodeURIComponent(
    Array.prototype.map
      .call(atob(cleanStr), (c: string) =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      )
      .join('')
  );
  return JSON.parse(json);
}

// Helper to wait until ICE gathering is complete or times out
function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    let timer: NodeJS.Timeout;

    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', checkState);
        clearTimeout(timer);
        resolve();
      }
    };

    pc.addEventListener('icegatheringstatechange', checkState);

    timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', checkState);
      resolve();
    }, timeoutMs);
  });
}

export function useWebRTC(onMessageReceived?: (msg: SyncMessage) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [replyCode, setReplyCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const onMessageRef = useRef(onMessageReceived);

  useEffect(() => {
    onMessageRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setStatus('disconnected');
    setRole(null);
    setInviteCode('');
    setReplyCode('');
    setErrorMessage(null);
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      setStatus('connected');
      setErrorMessage(null);
    };

    channel.onclose = () => {
      setStatus('disconnected');
    };

    channel.onerror = (err) => {
      console.error('RTCDataChannel error:', err);
    };

    channel.onmessage = (event) => {
      try {
        const data: SyncMessage = JSON.parse(event.data);
        if (onMessageRef.current) {
          onMessageRef.current(data);
        }
      } catch (err) {
        console.error('Error parsing sync message:', err);
      }
    };
  }, []);

  // HOST: Create offer and generate invite code
  const createHostOffer = useCallback(async (): Promise<string | null> => {
    try {
      cleanup();
      setRole('host');
      setStatus('generating-offer');
      setErrorMessage(null);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Reliable, ordered data channel
      const dc = pc.createDataChannel('sync-cinema-channel', {
        ordered: true,
      });
      setupDataChannel(dc);

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setStatus('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setStatus('disconnected');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE candidates to gather into localDescription
      await waitForIceGathering(pc);

      if (!pc.localDescription) {
        throw new Error('Failed to generate local SDP description');
      }

      const code = encodeSdp(pc.localDescription);
      setInviteCode(code);
      setStatus('waiting-for-answer');
      return code;
    } catch (err: unknown) {
      const errorStr = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to create invite code: ${errorStr}`);
      setStatus('error');
      return null;
    }
  }, [cleanup, setupDataChannel]);

  // HOST: Accept guest reply code (compressed SDP answer)
  const acceptGuestReply = useCallback(
    async (guestReplyCode: string): Promise<boolean> => {
      try {
        const pc = pcRef.current;
        if (!pc) {
          throw new Error('No peer connection initialized. Please generate an invite first.');
        }

        const answerDesc = decodeSdp(guestReplyCode);
        await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
        setErrorMessage(null);
        return true;
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Invalid reply code: ${errorStr}`);
        return false;
      }
    },
    []
  );

  // GUEST: Accept host invite code and generate reply code
  const createGuestAnswer = useCallback(
    async (hostInviteCode: string): Promise<string | null> => {
      try {
        cleanup();
        setRole('guest');
        setStatus('generating-answer');
        setErrorMessage(null);

        const offerDesc = decodeSdp(hostInviteCode);

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setStatus('connected');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setStatus('disconnected');
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await waitForIceGathering(pc);

        if (!pc.localDescription) {
          throw new Error('Failed to generate answer description');
        }

        const code = encodeSdp(pc.localDescription);
        setReplyCode(code);
        return code;
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Failed to accept invite code: ${errorStr}`);
        setStatus('error');
        return null;
      }
    },
    [cleanup, setupDataChannel]
  );

  // Send message over WebRTC data channel
  const sendMessage = useCallback((msg: SyncMessage): boolean => {
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === 'open'
    ) {
      try {
        dataChannelRef.current.send(JSON.stringify(msg));
        return true;
      } catch (err) {
        console.error('Failed to send WebRTC message:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    isConnected: status === 'connected',
    role,
    inviteCode,
    replyCode,
    errorMessage,
    createHostOffer,
    acceptGuestReply,
    createGuestAnswer,
    sendMessage,
    disconnect: cleanup,
  };
}
