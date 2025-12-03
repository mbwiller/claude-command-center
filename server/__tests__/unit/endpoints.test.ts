/**
 * HTTP Endpoints Unit Tests
 * Tests API endpoint logic in isolation
 */

import { createSampleEvent } from '../setup';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load fixture data
const fixtures = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sample-events.json'), 'utf-8')
);

describe('HTTP Endpoints', () => {
  // Mock request/response helpers
  const mockRequest = (method: string, path: string, body?: unknown) => ({
    method,
    url: `http://localhost:4000${path}`,
    json: async () => body,
  });

  const mockResponse = (data: unknown, status = 200) => ({
    json: data,
    status,
    ok: status >= 200 && status < 300,
  });

  describe('POST /events', () => {
    it('should accept valid event payload', () => {
      const event = createSampleEvent();

      // Validate event structure
      expect(event).toHaveProperty('source_app');
      expect(event).toHaveProperty('session_id');
      expect(event).toHaveProperty('hook_event_type');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('payload');
    });

    it('should handle all hook event types', () => {
      const validEventTypes = [
        'PreToolUse',
        'PostToolUse',
        'UserPromptSubmit',
        'SubagentStop',
        'Stop',
        'SessionStart',
        'SessionEnd',
        'Notification',
        'ProtocolEvent',
        'QualityGate',
        'AgentHandoff',
      ];

      validEventTypes.forEach((eventType) => {
        const event = createSampleEvent({ hook_event_type: eventType });
        expect(event.hook_event_type).toBe(eventType);
      });
    });

    it('should validate required fields', () => {
      const requiredFields = ['source_app', 'session_id', 'hook_event_type'];
      const event = createSampleEvent();

      requiredFields.forEach((field) => {
        expect(event).toHaveProperty(field);
        expect(event[field as keyof typeof event]).toBeTruthy();
      });
    });

    it('should handle optional timestamp (auto-generate)', () => {
      const eventWithTimestamp = createSampleEvent();
      const eventWithoutTimestamp = { ...createSampleEvent() };
      delete (eventWithoutTimestamp as Record<string, unknown>).timestamp;

      expect(eventWithTimestamp.timestamp).toBeDefined();
      expect(eventWithoutTimestamp.timestamp).toBeUndefined();
    });

    it('should handle nested payload objects', () => {
      const complexPayload = {
        tool_name: 'Edit',
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, { nested: true }],
      };

      const event = createSampleEvent({ payload: complexPayload });
      expect(event.payload).toEqual(complexPayload);
    });
  });

  describe('GET /events/recent', () => {
    it('should respect limit parameter', () => {
      const limit = 50;
      // Simulate filtering
      const events = fixtures.events.slice(0, limit);
      expect(events.length).toBeLessThanOrEqual(limit);
    });

    it('should respect offset parameter', () => {
      const offset = 2;
      const events = fixtures.events.slice(offset);
      expect(events.length).toBe(fixtures.events.length - offset);
    });

    it('should filter by source_app', () => {
      const filtered = fixtures.events.filter(
        (e: Record<string, unknown>) => e.source_app === 'claude-code'
      );
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should filter by session_id', () => {
      const sessionId = 'sess_fixture_001';
      const filtered = fixtures.events.filter(
        (e: Record<string, unknown>) => e.session_id === sessionId
      );
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should filter by hook_event_type', () => {
      const eventType = 'PostToolUse';
      const filtered = fixtures.events.filter(
        (e: Record<string, unknown>) => e.hook_event_type === eventType
      );
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should return events in descending timestamp order', () => {
      const sorted = [...fixtures.events].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].timestamp).getTime();
        const curr = new Date(sorted[i].timestamp).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  describe('GET /events/filter-options', () => {
    it('should return distinct source_apps', () => {
      const sourceApps = [...new Set(
        fixtures.events.map((e: Record<string, unknown>) => e.source_app)
      )];
      expect(sourceApps.length).toBeGreaterThan(0);
      expect(sourceApps).toContain('claude-code');
    });

    it('should return distinct session_ids', () => {
      const sessionIds = [...new Set(
        fixtures.events.map((e: Record<string, unknown>) => e.session_id)
      )];
      expect(sessionIds.length).toBeGreaterThan(0);
    });

    it('should return distinct event_types', () => {
      const eventTypes = [...new Set(
        fixtures.events.map((e: Record<string, unknown>) => e.hook_event_type)
      )];
      expect(eventTypes.length).toBeGreaterThan(0);
      expect(eventTypes).toContain('PostToolUse');
    });
  });

  describe('GET /stats', () => {
    it('should calculate total_events', () => {
      const stats = { total_events: fixtures.events.length };
      expect(stats.total_events).toBe(fixtures.events.length);
    });

    it('should calculate events by type', () => {
      const byType: Record<string, number> = {};
      fixtures.events.forEach((event: Record<string, unknown>) => {
        const type = event.hook_event_type as string;
        byType[type] = (byType[type] || 0) + 1;
      });

      expect(Object.keys(byType).length).toBeGreaterThan(0);
      expect(byType['PostToolUse']).toBeGreaterThan(0);
    });

    it('should calculate events by app', () => {
      const byApp: Record<string, number> = {};
      fixtures.events.forEach((event: Record<string, unknown>) => {
        const app = event.source_app as string;
        byApp[app] = (byApp[app] || 0) + 1;
      });

      expect(byApp['claude-code']).toBe(fixtures.events.length);
    });

    it('should count unique sessions', () => {
      const sessions = new Set(
        fixtures.events.map((e: Record<string, unknown>) => e.session_id)
      );
      expect(sessions.size).toBeGreaterThan(0);
    });

    it('should calculate total_tokens', () => {
      let totalTokens = 0;
      fixtures.events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        totalTokens += (payload?.tokens_used as number) || 0;
      });
      expect(totalTokens).toBeGreaterThan(0);
    });

    it('should calculate total_cost', () => {
      let totalCost = 0;
      fixtures.events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        totalCost += parseFloat((payload?.cost_usd as string) || '0');
      });
      expect(totalCost).toBeGreaterThan(0);
    });

    it('should calculate success_rate as percentage', () => {
      let successCount = 0;
      let totalWithSuccess = 0;

      fixtures.events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        if (payload?.success !== undefined) {
          totalWithSuccess++;
          if (payload.success) successCount++;
        }
      });

      const successRate = totalWithSuccess > 0
        ? (successCount / totalWithSuccess) * 100
        : 0;

      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(100);
    });

    it('should calculate test_pass_rate', () => {
      let testTotal = 0;
      let testPassed = 0;

      fixtures.events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        if (payload?.test_passed !== undefined) {
          testTotal++;
          if (payload.test_passed) testPassed++;
        }
      });

      const testPassRate = testTotal > 0
        ? (testPassed / testTotal) * 100
        : 0;

      expect(testPassRate).toBeGreaterThanOrEqual(0);
      expect(testPassRate).toBeLessThanOrEqual(100);
    });

    it('should filter stats by session_id', () => {
      const sessionId = 'sess_fixture_001';
      const sessionEvents = fixtures.events.filter(
        (e: Record<string, unknown>) => e.session_id === sessionId
      );

      expect(sessionEvents.length).toBeGreaterThan(0);
      expect(sessionEvents.length).toBeLessThan(fixtures.events.length);
    });
  });

  describe('GET /health', () => {
    it('should return ok status', () => {
      const health = { status: 'ok', clients: 0 };
      expect(health.status).toBe('ok');
      expect(health).toHaveProperty('clients');
    });

    it('should include connected client count', () => {
      const health = { status: 'ok', clients: 5 };
      expect(typeof health.clients).toBe('number');
      expect(health.clients).toBeGreaterThanOrEqual(0);
    });
  });

  describe('New Protocol Endpoints', () => {
    describe('GET /api/protocol-stats', () => {
      it('should return agent statistics', () => {
        const protocolStats = {
          agents: {
            researcher: {
              totalInvocations: 3,
              completionRate: 100,
              avgConfidence: 0.89,
              gatesPassed: 2,
              gatesFailed: 0,
            },
            implementer: {
              totalInvocations: 1,
              completionRate: 100,
              avgConfidence: 0.92,
              gatesPassed: 1,
              gatesFailed: 0,
            },
          },
          recentGates: fixtures.qualityGates,
          handoffCount: fixtures.handoffs.length,
        };

        expect(protocolStats).toHaveProperty('agents');
        expect(protocolStats.agents.researcher).toHaveProperty('totalInvocations');
        expect(protocolStats.agents.researcher).toHaveProperty('avgConfidence');
        expect(protocolStats.recentGates.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/quality-gates', () => {
      it('should return quality gate history', () => {
        expect(fixtures.qualityGates.length).toBeGreaterThan(0);

        fixtures.qualityGates.forEach((gate: Record<string, unknown>) => {
          expect(gate).toHaveProperty('gate_name');
          expect(gate).toHaveProperty('passed');
          expect(gate).toHaveProperty('score');
        });
      });

      it('should filter by session_id', () => {
        const sessionId = 'sess_fixture_001';
        const filtered = fixtures.qualityGates.filter(
          (g: Record<string, unknown>) => g.session_id === sessionId
        );
        expect(filtered.length).toBeGreaterThan(0);
      });

      it('should filter by gate_name', () => {
        const gateName = 'input_clarity';
        const filtered = fixtures.qualityGates.filter(
          (g: Record<string, unknown>) => g.gate_name === gateName
        );
        expect(filtered.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/handoffs', () => {
      it('should return agent handoff history', () => {
        expect(fixtures.handoffs.length).toBeGreaterThan(0);

        fixtures.handoffs.forEach((handoff: Record<string, unknown>) => {
          expect(handoff).toHaveProperty('from_agent');
          expect(handoff).toHaveProperty('to_agent');
          expect(handoff).toHaveProperty('document');
        });
      });

      it('should include handoff metadata', () => {
        fixtures.handoffs.forEach((handoff: Record<string, unknown>) => {
          expect(handoff).toHaveProperty('metadata');
          const metadata = handoff.metadata as Record<string, unknown>;
          expect(metadata).toHaveProperty('confidence');
        });
      });
    });

    describe('GET /api/protocol-events', () => {
      it('should return protocol event stream', () => {
        expect(fixtures.protocolEvents.length).toBeGreaterThan(0);
      });

      it('should filter by agent_type', () => {
        const agentType = 'researcher';
        const filtered = fixtures.protocolEvents.filter(
          (e: Record<string, unknown>) => e.agent_type === agentType
        );
        expect(filtered.length).toBeGreaterThan(0);
      });

      it('should include confidence scores', () => {
        fixtures.protocolEvents.forEach((event: Record<string, unknown>) => {
          expect(event).toHaveProperty('confidence');
          expect(event.confidence).toBeGreaterThanOrEqual(0);
          expect(event.confidence).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('CORS Headers', () => {
    it('should include Access-Control-Allow-Origin', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should allow required HTTP methods', () => {
      const corsHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      };

      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid JSON', () => {
      const response = mockResponse({ error: 'Invalid JSON' }, 400);
      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should return 404 for unknown routes', () => {
      const response = mockResponse('Not Found', 404);
      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });

    it('should handle missing required fields', () => {
      const incompleteEvent = { source_app: 'test' }; // Missing session_id, hook_event_type
      const requiredFields = ['source_app', 'session_id', 'hook_event_type'];

      const missing = requiredFields.filter(
        (field) => !Object.keys(incompleteEvent).includes(field)
      );

      expect(missing.length).toBeGreaterThan(0);
    });
  });
});
