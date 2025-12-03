/**
 * Vitest Test Setup
 * Global configuration for React component tests
 */

import '@testing-library/jest-dom';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
      // Send connected message
      if (this.onmessage) {
        this.onmessage({
          data: JSON.stringify({ type: 'connected', clients: 1 }),
        });
      }
    }, 10);
  }

  send(data) {
    // Handle ping/pong
    const parsed = JSON.parse(data);
    if (parsed.type === 'ping' && this.onmessage) {
      setTimeout(() => {
        this.onmessage({
          data: JSON.stringify({ type: 'pong' }),
        });
      }, 5);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ type: 'close' });
    }
  }

  // Simulate receiving an event
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({
        data: typeof data === 'string' ? data : JSON.stringify(data),
      });
    }
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;

// Mock fetch for API calls
global.fetch = vi.fn((url) => {
  // Mock different endpoints
  if (url.includes('/events/recent')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test_session_1',
            hook_event_type: 'PostToolUse',
            timestamp: new Date().toISOString(),
            payload: {
              tool_name: 'Edit',
              tokens_used: 150,
              cost_usd: '0.0045',
              success: true,
              agent_name: 'implementer',
            },
          },
        ]),
    });
  }

  if (url.includes('/events/filter-options')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          source_apps: ['claude-code'],
          session_ids: ['test_session_1'],
          event_types: ['PostToolUse', 'PreToolUse'],
        }),
    });
  }

  if (url.includes('/stats')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          total_events: 10,
          by_type: { PostToolUse: 5, PreToolUse: 5 },
          by_app: { 'claude-code': 10 },
          sessions: 2,
          total_tokens: 1500,
          total_cost: 0.045,
          success_rate: 90,
          test_pass_rate: 80,
        }),
    });
  }

  if (url.includes('/api/protocol-stats')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          agents: {
            researcher: {
              totalInvocations: 5,
              completionRate: 100,
              avgConfidence: 0.88,
              gatesPassed: 4,
              gatesFailed: 0,
            },
          },
          recentGates: [],
          handoffCount: 2,
        }),
    });
  }

  if (url.includes('/api/quality-gates')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            session_id: 'test_session_1',
            agent_type: 'researcher',
            gate_name: 'input_clarity',
            passed: true,
            score: 0.88,
            threshold: 0.8,
            feedback: 'Query is clear',
          },
        ]),
    });
  }

  if (url.includes('/api/handoffs')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            session_id: 'test_session_1',
            from_agent: 'researcher',
            to_agent: 'implementer',
            handoff_type: 'task_delegation',
          },
        ]),
    });
  }

  if (url.includes('/health')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', clients: 1 }),
    });
  }

  // Default response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
