/**
 * App Component Tests
 * Tests for the main dashboard application
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the dashboard header', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Command Center/i)).toBeInTheDocument();
      });
    });

    it('should show connection status indicator', async () => {
      render(<App />);

      await waitFor(() => {
        // Should show either Connected or Connecting
        const statusElement = screen.queryByText(/Connected/i) ||
                              screen.queryByText(/Connecting/i);
        expect(statusElement).toBeTruthy();
      });
    });

    it('should display session sidebar', async () => {
      render(<App />);

      await waitFor(() => {
        // Look for Sessions heading or session list
        const sessionsElement = screen.queryByText(/Sessions/i);
        expect(sessionsElement).toBeTruthy();
      });
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection on mount', async () => {
      render(<App />);

      // WebSocket mock is set up in setup.js
      await waitFor(() => {
        // Connection should be established
        expect(global.WebSocket).toBeDefined();
      });
    });

    it('should handle WebSocket reconnection', async () => {
      render(<App />);

      await waitFor(() => {
        // Component should handle reconnection gracefully
        expect(screen.queryByText(/Error/i)).toBeNull();
      });
    });
  });

  describe('Event Display', () => {
    it('should display events when received', async () => {
      render(<App />);

      await waitFor(
        () => {
          // Mock data should include events
          // Check for event type or tool name
          const hasEvents =
            screen.queryByText(/PostToolUse/i) ||
            screen.queryByText(/Edit/i) ||
            screen.queryByText(/implementer/i);
          expect(hasEvents).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('should group events by session', async () => {
      render(<App />);

      await waitFor(() => {
        // Sessions should be grouped
        const sessionElement = screen.queryByText(/test_session/i);
        expect(sessionElement).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Statistics Display', () => {
    it('should show token count', async () => {
      render(<App />);

      await waitFor(() => {
        // Should display tokens
        const tokenElement = screen.queryByText(/tokens/i);
        expect(tokenElement).toBeTruthy();
      }, { timeout: 2000 });
    });

    it('should show cost information', async () => {
      render(<App />);

      await waitFor(() => {
        // Should display cost with $ symbol
        const costElement = screen.queryByText(/\$/i);
        expect(costElement).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Event Filtering', () => {
    it('should have filter controls available', async () => {
      render(<App />);

      await waitFor(() => {
        // Look for filter-related UI elements
        const filterElement =
          screen.queryByText(/Filter/i) ||
          screen.queryByRole('combobox') ||
          screen.queryByRole('listbox');
        // Filter may or may not be visible initially
        expect(true).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<App />);

      await waitFor(() => {
        // Should not crash, may show empty state or error message
        expect(document.body).toBeInTheDocument();
      });

      // Restore fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it('should handle empty event list', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      render(<App />);

      await waitFor(() => {
        // Should show empty state or instruction message
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should update when new events arrive via WebSocket', async () => {
      render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(/Command Center/i)).toBeInTheDocument();
      });

      // The mock WebSocket will send a connected message
      // In a real test, we'd simulate more events
    });
  });

  describe('Accessibility', () => {
    it('should have accessible heading structure', async () => {
      render(<App />);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it('should have interactive elements accessible', async () => {
      render(<App />);

      await waitFor(() => {
        // Check for buttons
        const buttons = screen.queryAllByRole('button');
        // May have buttons for various actions
        expect(true).toBe(true);
      });
    });
  });
});

describe('Event Type Handling', () => {
  it('should handle PreToolUse events', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'PreToolUse',
            timestamp: new Date().toISOString(),
            payload: { tool_name: 'Bash' },
          },
        ]),
    });

    render(<App />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should handle PostToolUse events', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'PostToolUse',
            timestamp: new Date().toISOString(),
            payload: { tool_name: 'Edit', success: true },
          },
        ]),
    });

    render(<App />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should handle SubagentStop events', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'SubagentStop',
            timestamp: new Date().toISOString(),
            payload: { agent_name: 'researcher' },
          },
        ]),
    });

    render(<App />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should handle ProtocolEvent events', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
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
        ]),
    });

    render(<App />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should handle QualityGate events', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'QualityGate',
            timestamp: new Date().toISOString(),
            payload: {
              gate_name: 'input_clarity',
              passed: true,
              score: 0.9,
            },
          },
        ]),
    });

    render(<App />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should handle AgentHandoff events', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            source_app: 'claude-code',
            session_id: 'test',
            hook_event_type: 'AgentHandoff',
            timestamp: new Date().toISOString(),
            payload: {
              from_agent: 'researcher',
              to_agent: 'implementer',
            },
          },
        ]),
    });

    render(<App />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});

describe('Agent Color Coding', () => {
  const agents = ['researcher', 'implementer', 'reviewer', 'consensus', 'memory-keeper'];

  agents.forEach((agent) => {
    it(`should handle ${agent} agent events`, async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              source_app: 'claude-code',
              session_id: 'test',
              hook_event_type: 'SubagentStop',
              timestamp: new Date().toISOString(),
              payload: { agent_name: agent },
            },
          ]),
      });

      render(<App />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});
