/**
 * Tauri Events Hook for Claude Code Command Center
 *
 * Listens for events from the Rust backend via Tauri's event system.
 * Replaces WebSocket connection when running in Tauri.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

/**
 * Hook for managing real-time events from Tauri backend
 * @returns {Object} State and actions for managing events
 */
export const useTauriEvents = () => {
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState({});
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [serverPort, setServerPort] = useState(null);
  const seenEventIdsRef = useRef(new Set());
  const unlistenRefs = useRef([]);

  // Fetch existing events from Rust server
  const fetchExistingEvents = useCallback(async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}/events/recent`);
      if (response.ok) {
        const existingEvents = await response.json();
        if (existingEvents.length > 0) {
          // Deduplicate events
          const seenKeys = new Set();
          const dedupedEvents = existingEvents.filter(e => {
            const key = `${e.session_id}-${e.id}-${e.timestamp}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          setEvents(dedupedEvents);
          dedupedEvents.forEach(e => seenEventIdsRef.current.add(`${e.session_id}-${e.id}-${e.timestamp}`));

          // Build sessions
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

  useEffect(() => {
    if (!isTauri()) {
      setConnecting(false);
      return;
    }

    let isMounted = true;

    const setupListeners = async () => {
      try {
        // Dynamic import for Tauri API
        const { listen } = await import('@tauri-apps/api/event');

        // Listen for server status
        const unlistenStatus = await listen('server-status', (event) => {
          if (!isMounted) return;
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
          if (!isMounted) return;
          const { data: newEvent } = event.payload;
          if (!newEvent) return;

          // Deduplicate
          const eventKey = `${newEvent.session_id}-${newEvent.id}-${newEvent.timestamp}`;
          if (seenEventIdsRef.current.has(eventKey)) return;
          seenEventIdsRef.current.add(eventKey);

          // Add to events list
          setEvents(prev => [newEvent, ...prev].slice(0, 1000));

          // Update sessions
          setSessions(prev => {
            const updated = { ...prev };
            if (!updated[newEvent.session_id]) {
              updated[newEvent.session_id] = {
                id: newEvent.session_id,
                source_app: newEvent.source_app,
                events: [],
                firstEvent: newEvent.timestamp,
                lastEvent: newEvent.timestamp,
              };
            }
            updated[newEvent.session_id].events = [newEvent, ...updated[newEvent.session_id].events].slice(0, 500);
            updated[newEvent.session_id].lastEvent = newEvent.timestamp;
            return updated;
          });
        });
        unlistenRefs.current.push(unlistenEvent);

        // Listen for session deletion
        const unlistenDelete = await listen('session-deleted', (event) => {
          if (!isMounted) return;
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
          if (!isMounted) return;
          setEvents([]);
          setSessions({});
          seenEventIdsRef.current.clear();
        });
        unlistenRefs.current.push(unlistenClear);

        // Check if server is already running by polling health
        const checkHealth = async () => {
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
              // Port not available, try next
            }
          }
          // No server found yet, will wait for server-status event
          setConnecting(true);
        };

        // Initial health check
        await checkHealth();

      } catch (e) {
        console.error('Failed to setup Tauri listeners:', e);
        setConnecting(false);
      }
    };

    setupListeners();

    return () => {
      isMounted = false;
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, [fetchExistingEvents]);

  const clearEvents = useCallback(async () => {
    if (serverPort) {
      try {
        await fetch(`http://localhost:${serverPort}/events/clear`, { method: 'POST' });
      } catch (e) {
        console.error('Failed to clear events:', e);
      }
    }
    setEvents([]);
    setSessions({});
    seenEventIdsRef.current.clear();
  }, [serverPort]);

  const deleteSession = useCallback(async (sessionId) => {
    // Optimistic update
    setSessions(prev => {
      const updated = { ...prev };
      delete updated[sessionId];
      return updated;
    });
    setEvents(prev => prev.filter(e => e.session_id !== sessionId));

    if (serverPort) {
      try {
        await fetch(`http://localhost:${serverPort}/sessions/${sessionId}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.error('Failed to delete session:', e);
        // Refetch to restore state
        fetchExistingEvents(serverPort);
      }
    }
  }, [serverPort, fetchExistingEvents]);

  return {
    events,
    sessions,
    connected,
    connecting,
    clearEvents,
    deleteSession,
    isTauri: isTauri(),
    serverPort,
  };
};

export default useTauriEvents;
