/**
 * Real-time events hook for WebSocket connection and event management
 * Connects to the observability server and manages event state
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for managing real-time events from the observability server
 * @param {string} serverUrl - WebSocket server URL (e.g., 'ws://localhost:4000/stream')
 * @returns {Object} State and actions for managing events
 */
export const useRealTimeEvents = (serverUrl) => {
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState({});
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const seenEventIdsRef = useRef(new Set()); // Track seen events for deduplication

  // Fetch existing events from server on mount
  const fetchExistingEvents = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl.replace('ws:', 'http:').replace('/stream', '')}/events/recent?limit=500`);
      if (response.ok) {
        const existingEvents = await response.json();
        if (existingEvents.length > 0) {
          // Deduplicate events by composite key (session_id + id + timestamp)
          const seenKeys = new Set();
          const dedupedEvents = existingEvents.filter(e => {
            const key = `${e.session_id}-${e.id}-${e.timestamp}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          setEvents(dedupedEvents);
          // Populate seen event IDs for deduplication (using composite key)
          dedupedEvents.forEach(e => seenEventIdsRef.current.add(`${e.session_id}-${e.id}-${e.timestamp}`));
          // Build sessions from deduped events
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
  }, [serverUrl]);

  useEffect(() => {
    // Track if this effect instance is still mounted (handles React StrictMode double-mount)
    let isMounted = true;
    let ws = null;

    const connect = () => {
      if (!isMounted) return; // Don't connect if unmounted

      setConnecting(true);
      try {
        const wsUrl = serverUrl.replace('http:', 'ws:');
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          setConnected(true);
          setConnecting(false);
          // Fetch any existing events
          fetchExistingEvents();
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'event' && data.data) {
              const newEvent = data.data;

              // Deduplicate: skip if we've already seen this event (using composite key)
              const eventKey = `${newEvent.session_id}-${newEvent.id}-${newEvent.timestamp}`;
              if (seenEventIdsRef.current.has(eventKey)) {
                return;
              }
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
            }

            // Handle session deletion broadcast
            if (data.type === 'session_deleted' && data.sessionId) {
              setSessions(prev => {
                const updated = { ...prev };
                delete updated[data.sessionId];
                return updated;
              });
              setEvents(prev => prev.filter(e => e.session_id !== data.sessionId));
            }

            // Handle events cleared broadcast
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
          if (!isMounted) return;
          setConnected(false);
          setConnecting(false);
          // Reconnect after 3 seconds
          reconnectRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setConnecting(false);
          ws?.close();
        };
      } catch (e) {
        if (!isMounted) return;
        setConnected(false);
        setConnecting(false);
      }
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectRef.current);
      if (ws) {
        ws.close();
      }
    };
  }, [serverUrl, fetchExistingEvents]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setSessions({});
    seenEventIdsRef.current.clear(); // Clear deduplication cache
  }, []);

  // Delete a session via API
  const deleteSession = useCallback(async (sessionId) => {
    // Optimistic update - remove from state immediately
    setSessions(prev => {
      const updated = { ...prev };
      delete updated[sessionId];
      return updated;
    });
    setEvents(prev => prev.filter(e => e.session_id !== sessionId));

    try {
      const apiUrl = serverUrl.replace('ws:', 'http:').replace('/stream', '');
      const response = await fetch(`${apiUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
      // Refetch to restore state if delete failed
      fetchExistingEvents();
    }
  }, [serverUrl, fetchExistingEvents]);

  return { events, sessions, connected, connecting, clearEvents, deleteSession };
};

export default useRealTimeEvents;
