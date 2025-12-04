/**
 * Unified Events Hook
 *
 * Automatically selects between Tauri events (desktop) and WebSocket (browser).
 * Provides a consistent API regardless of the underlying transport.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

/**
 * Unified hook for managing real-time events
 * Automatically uses Tauri events in desktop app, WebSocket in browser
 * @param {string} wsServerUrl - WebSocket server URL (fallback for browser mode)
 * @returns {Object} State and actions for managing events
 */
export const useEvents = (wsServerUrl = 'ws://localhost:4000/stream') => {
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState({});
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [serverPort, setServerPort] = useState(null);
  const [mode, setMode] = useState(null); // 'tauri' or 'websocket'

  const seenEventIdsRef = useRef(new Set());
  const unlistenRefs = useRef([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // Build sessions from events
  const buildSessionFromEvent = useCallback((event, existingSessions) => {
    const updated = { ...existingSessions };
    if (!updated[event.session_id]) {
      updated[event.session_id] = {
        id: event.session_id,
        source_app: event.source_app,
        events: [],
        firstEvent: event.timestamp,
        lastEvent: event.timestamp,
      };
    }
    updated[event.session_id].events = [event, ...updated[event.session_id].events].slice(0, 500);
    if (event.timestamp > updated[event.session_id].lastEvent) {
      updated[event.session_id].lastEvent = event.timestamp;
    }
    if (event.timestamp < updated[event.session_id].firstEvent) {
      updated[event.session_id].firstEvent = event.timestamp;
    }
    return updated;
  }, []);

  // Fetch existing events from HTTP endpoint
  const fetchExistingEvents = useCallback(async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}/events/recent`);
      if (response.ok) {
        const existingEvents = await response.json();
        if (existingEvents.length > 0) {
          const seenKeys = new Set();
          const dedupedEvents = existingEvents.filter(e => {
            const key = `${e.session_id}-${e.id}-${e.timestamp}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          setEvents(dedupedEvents);
          dedupedEvents.forEach(e => seenEventIdsRef.current.add(`${e.session_id}-${e.id}-${e.timestamp}`));

          const sessionMap = {};
          dedupedEvents.forEach(event => {
            if (!sessionMap[event.session_id]) {
              sessionMap[event.session_id] = {
                id: event.session_id,
                source_app: event.source_app,
                events: [],
                firstEvent: event.timestamp,
                lastEvent: event.timestamp,
              };
            }
            sessionMap[event.session_id].events.push(event);
            if (event.timestamp < sessionMap[event.session_id].firstEvent) {
              sessionMap[event.session_id].firstEvent = event.timestamp;
            }
            if (event.timestamp > sessionMap[event.session_id].lastEvent) {
              sessionMap[event.session_id].lastEvent = event.timestamp;
            }
          });
          setSessions(sessionMap);
        }
      }
    } catch (e) {
      console.error('Failed to fetch existing events:', e);
    }
  }, []);

  // Process incoming event (shared by both modes)
  const processEvent = useCallback((newEvent) => {
    const eventKey = `${newEvent.session_id}-${newEvent.id}-${newEvent.timestamp}`;
    if (seenEventIdsRef.current.has(eventKey)) return;
    seenEventIdsRef.current.add(eventKey);

    setEvents(prev => [newEvent, ...prev].slice(0, 1000));
    setSessions(prev => buildSessionFromEvent(newEvent, prev));
  }, [buildSessionFromEvent]);

  // Initialize Tauri mode
  const initTauri = useCallback(async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');

      // Listen for server status
      const unlistenStatus = await listen('server-status', (event) => {
        const { status, port } = event.payload;
        if (status === 'online') {
          setConnected(true);
          setConnecting(false);
          setServerPort(port);
          fetchExistingEvents(port);
        } else {
          setConnected(false);
        }
      });
      unlistenRefs.current.push(unlistenStatus);

      // Listen for new events
      const unlistenEvent = await listen('new-event', (event) => {
        const { data: newEvent } = event.payload;
        if (newEvent) processEvent(newEvent);
      });
      unlistenRefs.current.push(unlistenEvent);

      // Listen for session deletion
      const unlistenDelete = await listen('session-deleted', (event) => {
        const { sessionId } = event.payload;
        setSessions(prev => {
          const updated = { ...prev };
          delete updated[sessionId];
          return updated;
        });
        setEvents(prev => prev.filter(e => e.session_id !== sessionId));
      });
      unlistenRefs.current.push(unlistenDelete);

      // Listen for events cleared
      const unlistenClear = await listen('events-cleared', () => {
        setEvents([]);
        setSessions({});
        seenEventIdsRef.current.clear();
      });
      unlistenRefs.current.push(unlistenClear);

      // Check if server is already running
      for (const port of [4000, 4001, 4002, 4003, 4004, 4005]) {
        try {
          const response = await fetch(`http://localhost:${port}/health`);
          if (response.ok) {
            setConnected(true);
            setConnecting(false);
            setServerPort(port);
            fetchExistingEvents(port);
            return;
          }
        } catch {
          // Port not available
        }
      }

      setConnecting(true);
    } catch (e) {
      console.error('Failed to initialize Tauri mode:', e);
      setConnecting(false);
    }
  }, [fetchExistingEvents, processEvent]);

  // Initialize WebSocket mode
  const initWebSocket = useCallback(() => {
    const connect = () => {
      setConnecting(true);
      try {
        const wsUrl = wsServerUrl.replace('http:', 'ws:');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          setConnecting(false);
          // Extract port from URL and fetch existing events
          try {
            const url = new URL(wsServerUrl.replace('ws:', 'http:'));
            fetchExistingEvents(url.port || '4000');
          } catch {
            fetchExistingEvents(4000);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'event' && data.data) {
              processEvent(data.data);
            }
            if (data.type === 'session_deleted' && data.sessionId) {
              setSessions(prev => {
                const updated = { ...prev };
                delete updated[data.sessionId];
                return updated;
              });
              setEvents(prev => prev.filter(e => e.session_id !== data.sessionId));
            }
            if (data.type === 'events_cleared') {
              setEvents([]);
              setSessions({});
              seenEventIdsRef.current.clear();
            }
          } catch (e) {
            console.error('Failed to parse event:', e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          setConnecting(false);
          reconnectRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setConnecting(false);
          ws?.close();
        };
      } catch (e) {
        setConnected(false);
        setConnecting(false);
      }
    };

    connect();
  }, [wsServerUrl, fetchExistingEvents, processEvent]);

  // Main initialization effect
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isTauri()) {
        setMode('tauri');
        if (isMounted) await initTauri();
      } else {
        setMode('websocket');
        if (isMounted) initWebSocket();
      }
    };

    init();

    return () => {
      isMounted = false;
      clearTimeout(reconnectRef.current);
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [initTauri, initWebSocket]);

  // Clear events
  const clearEvents = useCallback(async () => {
    if (mode === 'tauri' && serverPort) {
      try {
        await fetch(`http://localhost:${serverPort}/events/clear`, { method: 'POST' });
      } catch (e) {
        console.error('Failed to clear events:', e);
      }
    }
    setEvents([]);
    setSessions({});
    seenEventIdsRef.current.clear();
  }, [mode, serverPort]);

  // Delete session
  const deleteSession = useCallback(async (sessionId) => {
    // Optimistic update
    setSessions(prev => {
      const updated = { ...prev };
      delete updated[sessionId];
      return updated;
    });
    setEvents(prev => prev.filter(e => e.session_id !== sessionId));

    if (mode === 'tauri' && serverPort) {
      try {
        await fetch(`http://localhost:${serverPort}/sessions/${sessionId}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.error('Failed to delete session:', e);
        fetchExistingEvents(serverPort);
      }
    } else if (mode === 'websocket') {
      try {
        const apiUrl = wsServerUrl.replace('ws:', 'http:').replace('/stream', '');
        await fetch(`${apiUrl}/sessions/${sessionId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
    }
  }, [mode, serverPort, wsServerUrl, fetchExistingEvents]);

  return {
    events,
    sessions,
    connected,
    connecting,
    clearEvents,
    deleteSession,
    mode,
    serverPort,
  };
};

export default useEvents;
