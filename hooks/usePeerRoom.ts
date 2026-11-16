'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { DataConnection, Peer as PeerInstance } from 'peerjs';
import { SyncMessage } from '@/types/watch-party';

export type PeerRoomStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function generateShortRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = 'sync-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function usePeerRoom(onMessageReceived?: (msg: SyncMessage) => void) {
  const [status, setStatus] = useState<PeerRoomStatus>('disconnected');
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [peerId, setPeerId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const peerRef = useRef<PeerInstance | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef(onMessageReceived);

  useEffect(() => {
    onMessageRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const cleanup = useCallback(() => {
    if (connRef.current) {
      try {
        connRef.current.close();
      } catch {}
      connRef.current = null;
    }
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {}
      peerRef.current = null;
    }
    setStatus('disconnected');
    setRole(null);
    setRoomId('');
    setPeerId('');
    setErrorMessage(null);
  }, []);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      setStatus('connected');
      setErrorMessage(null);
    });

    conn.on('data', (data) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : (data as SyncMessage);
        if (onMessageRef.current) {
          onMessageRef.current(msg);
        }
      } catch (err) {
        console.error('Error handling PeerJS message:', err);
      }
    });

    conn.on('close', () => {
      setStatus('disconnected');
      connRef.current = null;
    });

    conn.on('error', (err) => {
      console.error('PeerJS DataConnection error:', err);
      setErrorMessage(`Connection error: ${err.message || 'DataChannel failed'}`);
    });
  }, []);

  // HOST: Create a room with a short, friendly ID
  const hostRoom = useCallback(async (): Promise<string | null> => {
    cleanup();
    setStatus('connecting');
    setRole('host');
    setErrorMessage(null);

    try {
      const PeerModule = (await import('peerjs')).default;
      const proposedId = generateShortRoomId();

      const peer = new PeerModule(proposedId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });
      peerRef.current = peer;

      return new Promise<string | null>((resolve) => {
        peer.on('open', (id) => {
          setPeerId(id);
          setRoomId(id);
          resolve(id);
        });

        peer.on('connection', (conn) => {
          setupDataConnection(conn);
        });

        peer.on('error', (err) => {
          console.error('PeerJS Host error:', err);
          // If ID collision, retry once with random ID
          if (err.type === 'unavailable-id') {
            const fallbackId = generateShortRoomId();
            const fallbackPeer = new PeerModule(fallbackId);
            peerRef.current = fallbackPeer;
            fallbackPeer.on('open', (newId) => {
              setPeerId(newId);
              setRoomId(newId);
              resolve(newId);
            });
            fallbackPeer.on('connection', (conn) => {
              setupDataConnection(conn);
            });
            return;
          }
          setErrorMessage(`Host error: ${err.message || err.type}`);
          setStatus('error');
          resolve(null);
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to initialize host: ${msg}`);
      setStatus('error');
      return null;
    }
  }, [cleanup, setupDataConnection]);

  // GUEST: Join room directly by Room ID
  const joinRoom = useCallback(
    async (targetRoomId: string): Promise<boolean> => {
      const cleanTarget = targetRoomId.trim();
      if (!cleanTarget) return false;

      cleanup();
      setStatus('connecting');
      setRole('guest');
      setRoomId(cleanTarget);
      setErrorMessage(null);

      try {
        const PeerModule = (await import('peerjs')).default;
        const peer = new PeerModule({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          },
        });
        peerRef.current = peer;

        return new Promise<boolean>((resolve) => {
          peer.on('open', (id) => {
            setPeerId(id);
            const conn = peer.connect(cleanTarget, {
              reliable: true,
            });
            setupDataConnection(conn);

            conn.on('open', () => {
              resolve(true);
            });
          });

          peer.on('error', (err) => {
            console.error('PeerJS Guest error:', err);
            let userMsg = err.message || err.type;
            if (err.type === 'peer-unavailable') {
              userMsg = `Room "${cleanTarget}" not found. Verify the Room ID or ensure the Host has the room open.`;
            }
            setErrorMessage(userMsg);
            setStatus('error');
            resolve(false);
          });
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Failed to join room: ${msg}`);
        setStatus('error');
        return false;
      }
    },
    [cleanup, setupDataConnection]
  );

  // Send message over PeerJS connection
  const sendMessage = useCallback((msg: SyncMessage): boolean => {
    if (connRef.current && connRef.current.open) {
      try {
        connRef.current.send(msg);
        return true;
      } catch (err) {
        console.error('Failed to send message via PeerJS:', err);
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
    roomId,
    peerId,
    errorMessage,
    hostRoom,
    joinRoom,
    sendMessage,
    disconnect: cleanup,
  };
}
