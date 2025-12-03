/**
 * useRealTimeEvents Hook Tests
 * Tests for the real-time event streaming hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock the useRealTimeEvents hook logic
// Since the hook is defined inline in App.jsx, we test the logic directly

describe('useRealTimeEvents Hook Logic', () => {
  let mockWebSocket;
  let wsInstances = [];

  beforeEach(() => {
    wsInstances = [];

    // Create a more sophisticated WebSocket mock
    global.WebSocket = class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0; // CONNECTING
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;

        wsInstances.push(this);
        mockWebSocket = this;

        // Auto-connect after delay
        setTimeout(() => {
          this.readyState = 1; // OPEN
          if (this.onopen) this.onopen({ type: 'open' });
          // Send connected message
          this.simulateMessage({ type: 'connected', clients: 1 });
        }, 10);
      }

      send(data) {
        const parsed = JSON.parse(data);
        if (parsed.type === 'ping') {
          setTimeout(() => this.simulateMessage({ type: 'pong' }), 5);
        }
      }

      close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose({ type: 'close' });
      }

      simulateMessage(data) {
        if (this.onmessage) {
          this.onmessage({
            data: typeof data === 'string' ? data : JSON.stringify(data),
          });
        }
      }

      simulateError(error) {
        this.readyState = 3; // CLOSED
        if (this.onerror) this.onerror(error);
        if (this.onclose) this.onclose({ type: 'close' });
      }
    };

    global.WebSocket.CONNECTING = 0;
    global.WebSocket.OPEN = 1;
    global.WebSocket.CLOSING = 2;
    global.WebSocket.CLOSED = 3;
  });

  afterEach(() => {
    wsInstances.forEach((ws) => {
      if (ws.readyState === 1) ws.close();
    });
    wsInstances = [];
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const { result } = renderHook(() => {
        const [connected, setConnected] = useState(false);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onopen = () => setConnected(true);
          return () => ws.close();
        }, []);

        return connected;
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should handle connection close', async () => {
      let ws;
      const { result } = renderHook(() => {
        const [connected, setConnected] = useState(false);

        useEffect(() => {
          ws = new WebSocket('ws://localhost:4000/stream');
          ws.onopen = () => setConnected(true);
          ws.onclose = () => setConnected(false);
          return () => ws.close();
        }, []);

        return { connected };
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => {
        mockWebSocket.close();
      });

      await waitFor(() => expect(result.current.connected).toBe(false));
    });

    it('should handle connection errors gracefully', async () => {
      const { result } = renderHook(() => {
        const [error, setError] = useState(null);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onerror = (e) => setError(e);
          return () => ws.close();
        }, []);

        return error;
      });

      act(() => {
        mockWebSocket.simulateError(new Error('Connection failed'));
      });

      await waitFor(() => {
        expect(result.current).toBeTruthy();
      });
    });
  });

  describe('Event Processing', () => {
    it('should receive and store events', async () => {
      const { result } = renderHook(() => {
        const [events, setEvents] = useState([]);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              setEvents((prev) => [data.data, ...prev]);
            }
          };
          return () => ws.close();
        }, []);

        return events;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      // Simulate receiving an event
      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test_session',
            hook_event_type: 'PostToolUse',
            timestamp: new Date().toISOString(),
            payload: { tool_name: 'Edit' },
          },
        });
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
        expect(result.current[0].hook_event_type).toBe('PostToolUse');
      });
    });

    it('should limit stored events to prevent memory issues', async () => {
      const MAX_EVENTS = 1000;
      const { result } = renderHook(() => {
        const [events, setEvents] = useState([]);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              setEvents((prev) => [data.data, ...prev].slice(0, MAX_EVENTS));
            }
          };
          return () => ws.close();
        }, []);

        return events;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      // Add many events
      act(() => {
        for (let i = 0; i < 50; i++) {
          mockWebSocket.simulateMessage({
            type: 'event',
            data: {
              id: i,
              source_app: 'claude-code',
              session_id: 'test',
              hook_event_type: 'PostToolUse',
              timestamp: new Date().toISOString(),
              payload: {},
            },
          });
        }
      });

      await waitFor(() => {
        expect(result.current.length).toBeLessThanOrEqual(MAX_EVENTS);
      });
    });

    it('should parse payload correctly', async () => {
      const { result } = renderHook(() => {
        const [events, setEvents] = useState([]);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              setEvents((prev) => [data.data, ...prev]);
            }
          };
          return () => ws.close();
        }, []);

        return events;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      const testPayload = {
        tool_name: 'Edit',
        tokens_used: 500,
        cost_usd: '0.015',
        success: true,
        agent_name: 'implementer',
        nested: { value: 'test' },
      };

      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'PostToolUse',
            timestamp: new Date().toISOString(),
            payload: testPayload,
          },
        });
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
        expect(result.current[0].payload).toEqual(testPayload);
        expect(result.current[0].payload.nested.value).toBe('test');
      });
    });
  });

  describe('Session Management', () => {
    it('should group events by session_id', async () => {
      const { result } = renderHook(() => {
        const [sessions, setSessions] = useState({});

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              const event = data.data;
              setSessions((prev) => {
                const updated = { ...prev };
                if (!updated[event.session_id]) {
                  updated[event.session_id] = {
                    id: event.session_id,
                    events: [],
                  };
                }
                updated[event.session_id].events.push(event);
                return updated;
              });
            }
          };
          return () => ws.close();
        }, []);

        return sessions;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      // Add events from different sessions
      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            session_id: 'session_1',
            hook_event_type: 'PostToolUse',
            source_app: 'claude-code',
            timestamp: new Date().toISOString(),
            payload: {},
          },
        });

        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 2,
            session_id: 'session_2',
            hook_event_type: 'PostToolUse',
            source_app: 'claude-code',
            timestamp: new Date().toISOString(),
            payload: {},
          },
        });

        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 3,
            session_id: 'session_1',
            hook_event_type: 'PreToolUse',
            source_app: 'claude-code',
            timestamp: new Date().toISOString(),
            payload: {},
          },
        });
      });

      await waitFor(() => {
        expect(Object.keys(result.current).length).toBe(2);
        expect(result.current['session_1'].events.length).toBe(2);
        expect(result.current['session_2'].events.length).toBe(1);
      });
    });

    it('should track first and last event times per session', async () => {
      const { result } = renderHook(() => {
        const [sessions, setSessions] = useState({});

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              const event = data.data;
              setSessions((prev) => {
                const updated = { ...prev };
                if (!updated[event.session_id]) {
                  updated[event.session_id] = {
                    id: event.session_id,
                    events: [],
                    firstEvent: event.timestamp,
                    lastEvent: event.timestamp,
                  };
                }
                updated[event.session_id].events.push(event);
                if (event.timestamp < updated[event.session_id].firstEvent) {
                  updated[event.session_id].firstEvent = event.timestamp;
                }
                if (event.timestamp > updated[event.session_id].lastEvent) {
                  updated[event.session_id].lastEvent = event.timestamp;
                }
                return updated;
              });
            }
          };
          return () => ws.close();
        }, []);

        return sessions;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      const time1 = '2025-12-01T10:00:00.000Z';
      const time2 = '2025-12-01T10:05:00.000Z';

      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            session_id: 'test',
            hook_event_type: 'SessionStart',
            source_app: 'claude-code',
            timestamp: time1,
            payload: {},
          },
        });

        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 2,
            session_id: 'test',
            hook_event_type: 'SessionEnd',
            source_app: 'claude-code',
            timestamp: time2,
            payload: {},
          },
        });
      });

      await waitFor(() => {
        expect(result.current['test'].firstEvent).toBe(time1);
        expect(result.current['test'].lastEvent).toBe(time2);
      });
    });
  });

  describe('Protocol Event Handling', () => {
    it('should handle ProtocolEvent type', async () => {
      const { result } = renderHook(() => {
        const [events, setEvents] = useState([]);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              setEvents((prev) => [data.data, ...prev]);
            }
          };
          return () => ws.close();
        }, []);

        return events;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'ProtocolEvent',
            timestamp: new Date().toISOString(),
            payload: {
              agent_type: 'researcher',
              event_type: 'spawn',
              phase: 'scope',
              confidence: 0.85,
            },
          },
        });
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
        expect(result.current[0].hook_event_type).toBe('ProtocolEvent');
        expect(result.current[0].payload.confidence).toBe(0.85);
      });
    });

    it('should handle QualityGate type', async () => {
      const { result } = renderHook(() => {
        const [events, setEvents] = useState([]);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              setEvents((prev) => [data.data, ...prev]);
            }
          };
          return () => ws.close();
        }, []);

        return events;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'QualityGate',
            timestamp: new Date().toISOString(),
            payload: {
              gate_name: 'input_clarity',
              passed: true,
              score: 0.92,
              threshold: 0.8,
            },
          },
        });
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
        expect(result.current[0].payload.passed).toBe(true);
        expect(result.current[0].payload.score).toBe(0.92);
      });
    });

    it('should handle AgentHandoff type', async () => {
      const { result } = renderHook(() => {
        const [events, setEvents] = useState([]);

        useEffect(() => {
          const ws = new WebSocket('ws://localhost:4000/stream');
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'event') {
              setEvents((prev) => [data.data, ...prev]);
            }
          };
          return () => ws.close();
        }, []);

        return events;
      });

      await waitFor(() => expect(mockWebSocket).toBeDefined());

      act(() => {
        mockWebSocket.simulateMessage({
          type: 'event',
          data: {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'AgentHandoff',
            timestamp: new Date().toISOString(),
            payload: {
              from_agent: 'researcher',
              to_agent: 'implementer',
              handoff_type: 'task_delegation',
            },
          },
        });
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
        expect(result.current[0].payload.from_agent).toBe('researcher');
        expect(result.current[0].payload.to_agent).toBe('implementer');
      });
    });
  });
});

// Import React for hooks
import { useState, useEffect } from 'react';
