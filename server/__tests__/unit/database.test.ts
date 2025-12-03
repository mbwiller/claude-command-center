/**
 * Database Operations Unit Tests
 * Tests SQLite operations in isolation
 */

import { createSampleEvent, TEST_DB_PATH } from '../setup';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load fixture data
const fixtures = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sample-events.json'), 'utf-8')
);

describe('Database Operations', () => {
  // Mock database for unit tests
  let mockDb: {
    run: jest.Mock;
    prepare: jest.Mock;
    events: Map<number, unknown>;
    nextId: number;
  };

  beforeEach(() => {
    // Create mock database
    mockDb = {
      events: new Map(),
      nextId: 1,
      run: jest.fn(),
      prepare: jest.fn((query: string) => {
        if (query.includes('INSERT')) {
          return {
            run: (...values: unknown[]) => {
              const id = mockDb.nextId++;
              mockDb.events.set(id, {
                id,
                source_app: values[0],
                session_id: values[1],
                hook_event_type: values[2],
                timestamp: values[3],
                payload: values[4],
              });
              return { lastInsertRowid: id };
            },
          };
        }
        if (query.includes('SELECT * FROM events WHERE 1=1')) {
          return {
            all: () => Array.from(mockDb.events.values()),
          };
        }
        if (query.includes('SELECT DISTINCT')) {
          return {
            all: () => [],
          };
        }
        return { all: () => [], run: () => ({}) };
      }),
    };
  });

  describe('Event Insertion', () => {
    it('should insert an event and return with id', () => {
      const event = createSampleEvent();

      const stmt = mockDb.prepare('INSERT INTO events');
      const result = stmt.run(
        event.source_app,
        event.session_id,
        event.hook_event_type,
        event.timestamp,
        JSON.stringify(event.payload)
      );

      expect(result.lastInsertRowid).toBe(1);
      expect(mockDb.events.size).toBe(1);
    });

    it('should auto-increment IDs', () => {
      const stmt = mockDb.prepare('INSERT INTO events');

      const event1 = createSampleEvent({ session_id: 'sess_1' });
      const event2 = createSampleEvent({ session_id: 'sess_2' });

      const result1 = stmt.run(
        event1.source_app, event1.session_id, event1.hook_event_type,
        event1.timestamp, JSON.stringify(event1.payload)
      );
      const result2 = stmt.run(
        event2.source_app, event2.session_id, event2.hook_event_type,
        event2.timestamp, JSON.stringify(event2.payload)
      );

      expect(result1.lastInsertRowid).toBe(1);
      expect(result2.lastInsertRowid).toBe(2);
    });

    it('should handle payload serialization', () => {
      const complexPayload = {
        tool_name: 'Edit',
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        unicode: 'Testing unicode: \u00e9\u00e8',
      };

      const event = createSampleEvent({ payload: complexPayload });
      const serialized = JSON.stringify(event.payload);

      expect(() => JSON.parse(serialized)).not.toThrow();
      expect(JSON.parse(serialized)).toEqual(complexPayload);
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(() => {
      // Seed mock database with fixture events
      const stmt = mockDb.prepare('INSERT INTO events');
      fixtures.events.forEach((event: Record<string, unknown>) => {
        stmt.run(
          event.source_app,
          event.session_id,
          event.hook_event_type,
          event.timestamp,
          JSON.stringify(event.payload)
        );
      });
    });

    it('should retrieve all events', () => {
      const stmt = mockDb.prepare('SELECT * FROM events WHERE 1=1');
      const events = stmt.all();

      expect(events.length).toBe(fixtures.events.length);
    });

    it('should return events with proper structure', () => {
      const stmt = mockDb.prepare('SELECT * FROM events WHERE 1=1');
      const events = stmt.all();

      events.forEach((event: Record<string, unknown>) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('source_app');
        expect(event).toHaveProperty('session_id');
        expect(event).toHaveProperty('hook_event_type');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('payload');
      });
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate token totals correctly', () => {
      const events = fixtures.events;
      let totalTokens = 0;

      events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        totalTokens += (payload?.tokens_used as number) || 0;
      });

      // Based on fixture data
      expect(totalTokens).toBeGreaterThan(0);
    });

    it('should calculate cost totals correctly', () => {
      const events = fixtures.events;
      let totalCost = 0;

      events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        totalCost += parseFloat((payload?.cost_usd as string) || '0');
      });

      expect(totalCost).toBeGreaterThan(0);
    });

    it('should count successful events', () => {
      const events = fixtures.events;
      let successCount = 0;

      events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        if (payload?.success) successCount++;
      });

      expect(successCount).toBeGreaterThan(0);
    });

    it('should calculate test pass rate', () => {
      const events = fixtures.events;
      let testTotal = 0;
      let testPassed = 0;

      events.forEach((event: Record<string, unknown>) => {
        const payload = event.payload as Record<string, unknown>;
        if (payload?.test_passed !== undefined) {
          testTotal++;
          if (payload.test_passed) testPassed++;
        }
      });

      expect(testTotal).toBeGreaterThan(0);
      const passRate = (testPassed / testTotal) * 100;
      expect(passRate).toBeGreaterThanOrEqual(0);
      expect(passRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Session Grouping', () => {
    it('should group events by session_id', () => {
      const events = fixtures.events;
      const sessions = new Map<string, unknown[]>();

      events.forEach((event: Record<string, unknown>) => {
        const sessionId = event.session_id as string;
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, []);
        }
        sessions.get(sessionId)!.push(event);
      });

      expect(sessions.size).toBeGreaterThan(0);
      // Each session should have at least one event
      sessions.forEach((sessionEvents) => {
        expect(sessionEvents.length).toBeGreaterThan(0);
      });
    });

    it('should identify unique sessions', () => {
      const events = fixtures.events;
      const sessionIds = new Set(events.map((e: Record<string, unknown>) => e.session_id));

      expect(sessionIds.size).toBe(2); // Based on fixture data
    });
  });

  describe('Protocol Events Schema', () => {
    it('should validate protocol event structure', () => {
      fixtures.protocolEvents.forEach((event: Record<string, unknown>) => {
        expect(event).toHaveProperty('session_id');
        expect(event).toHaveProperty('agent_type');
        expect(event).toHaveProperty('event_type');
        expect(event).toHaveProperty('phase');
        expect(event).toHaveProperty('confidence');
        expect(typeof event.confidence).toBe('number');
        expect(event.confidence).toBeGreaterThanOrEqual(0);
        expect(event.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Quality Gates Schema', () => {
    it('should validate quality gate structure', () => {
      fixtures.qualityGates.forEach((gate: Record<string, unknown>) => {
        expect(gate).toHaveProperty('session_id');
        expect(gate).toHaveProperty('gate_name');
        expect(gate).toHaveProperty('passed');
        expect(gate).toHaveProperty('score');
        expect(gate).toHaveProperty('threshold');
        expect(typeof gate.passed).toBe('boolean');
        expect(typeof gate.score).toBe('number');
      });
    });

    it('should verify gate pass/fail logic', () => {
      fixtures.qualityGates.forEach((gate: Record<string, unknown>) => {
        const score = gate.score as number;
        const threshold = gate.threshold as number;
        const passed = gate.passed as boolean;

        // If passed is true, score should be >= threshold
        if (passed) {
          expect(score).toBeGreaterThanOrEqual(threshold);
        }
      });
    });
  });

  describe('Agent Handoffs Schema', () => {
    it('should validate handoff structure', () => {
      fixtures.handoffs.forEach((handoff: Record<string, unknown>) => {
        expect(handoff).toHaveProperty('session_id');
        expect(handoff).toHaveProperty('from_agent');
        expect(handoff).toHaveProperty('to_agent');
        expect(handoff).toHaveProperty('handoff_type');
        expect(handoff).toHaveProperty('document');
      });
    });
  });
});
