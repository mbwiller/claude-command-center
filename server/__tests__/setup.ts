/**
 * Jest Test Setup
 * Global configuration and utilities for server tests
 */

import { rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Test database path (separate from production)
export const TEST_DB_PATH = './test-events.db';

// Test server configuration
export const TEST_PORT = 4001;
export const TEST_SERVER_URL = `http://localhost:${TEST_PORT}`;
export const TEST_WS_URL = `ws://localhost:${TEST_PORT}/stream`;

// Sample test data
export const createSampleEvent = (overrides = {}) => ({
  source_app: 'claude-code',
  session_id: `test_session_${Date.now()}`,
  hook_event_type: 'PostToolUse',
  timestamp: new Date().toISOString(),
  payload: {
    tool_name: 'Edit',
    tokens_used: 150,
    cost_usd: '0.0045',
    success: true,
    agent_name: 'implementer',
    duration_ms: 250,
  },
  ...overrides,
});

// Wait utility for async operations
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Clean up test database before/after tests
export async function cleanupTestDatabase() {
  if (existsSync(TEST_DB_PATH)) {
    await rm(TEST_DB_PATH);
  }
}

// Global setup
beforeAll(async () => {
  // Ensure clean test environment
  await cleanupTestDatabase();
});

// Global teardown
afterAll(async () => {
  // Clean up test artifacts
  await cleanupTestDatabase();
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});
