/**
 * Claude Code Command Center - Node.js Observability Server
 * Pure JavaScript server - no native dependencies required
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';

// Types
interface Event {
  id: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface EventPayload {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

// In-memory event store (simple and no native deps)
class EventStore {
  private events: Event[] = [];
  private nextId = 1;
  private maxEvents = 5000; // Keep last 5000 events in memory

  insert(payload: EventPayload): Event {
    const event: Event = {
      id: this.nextId++,
      source_app: payload.source_app,
      session_id: payload.session_id,
      hook_event_type: payload.hook_event_type,
      timestamp: payload.timestamp || new Date().toISOString(),
      payload: payload.payload || {},
      created_at: new Date().toISOString(),
    };

    this.events.unshift(event); // Add to front for recent-first order

    // Trim if over limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    return event;
  }

  getRecent(limit = 100, offset = 0, filters?: {
    source_app?: string;
    session_id?: string;
    hook_event_type?: string;
  }): Event[] {
    let filtered = this.events;

    if (filters?.source_app) {
      filtered = filtered.filter(e => e.source_app === filters.source_app);
    }
    if (filters?.session_id) {
      filtered = filtered.filter(e => e.session_id === filters.session_id);
    }
    if (filters?.hook_event_type) {
      filtered = filtered.filter(e => e.hook_event_type === filters.hook_event_type);
    }

    return filtered.slice(offset, offset + limit);
  }

  getStats(sessionId?: string) {
    let events = sessionId
      ? this.events.filter(e => e.session_id === sessionId)
      : this.events;

    const stats = {
      total_events: events.length,
      by_type: {} as Record<string, number>,
      by_app: {} as Record<string, number>,
      sessions: new Set<string>(),
      total_tokens: 0,
      total_cost: 0,
      success_count: 0,
      test_pass_count: 0,
      test_total: 0,
    };

    for (const event of events) {
      stats.by_type[event.hook_event_type] = (stats.by_type[event.hook_event_type] || 0) + 1;
      stats.by_app[event.source_app] = (stats.by_app[event.source_app] || 0) + 1;
      stats.sessions.add(event.session_id);

      const payload = event.payload;
      stats.total_tokens += (payload?.tokens_used as number) || 0;
      stats.total_cost += parseFloat((payload?.cost_usd as string) || '0');
      if (payload?.success) stats.success_count++;
      if (payload?.test_passed !== undefined) {
        stats.test_total++;
        if (payload.test_passed) stats.test_pass_count++;
      }
    }

    return {
      ...stats,
      sessions: stats.sessions.size,
      success_rate: events.length > 0 ? (stats.success_count / events.length) * 100 : 0,
      test_pass_rate: stats.test_total > 0 ? (stats.test_pass_count / stats.test_total) * 100 : 0,
    };
  }

  getFilterOptions() {
    const sourceApps = new Set<string>();
    const sessionIds = new Set<string>();
    const eventTypes = new Set<string>();

    for (const event of this.events.slice(0, 1000)) {
      sourceApps.add(event.source_app);
      sessionIds.add(event.session_id);
      eventTypes.add(event.hook_event_type);
    }

    return {
      source_apps: Array.from(sourceApps),
      session_ids: Array.from(sessionIds).slice(0, 50),
      event_types: Array.from(eventTypes),
    };
  }

  // Delete a session and all its events
  deleteSession(sessionId: string): { success: boolean; deletedEvents: number } {
    const before = this.events.length;
    this.events = this.events.filter(e => e.session_id !== sessionId);
    const deletedEvents = before - this.events.length;
    return { success: true, deletedEvents };
  }
}

// Initialize store
const store = new EventStore();

// WebSocket clients
const wsClients = new Set<WebSocket>();

// Broadcast to all clients
function broadcastEvent(event: Event) {
  const message = JSON.stringify({
    type: 'event',
    data: event,
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        wsClients.delete(client);
      }
    }
  }
}

// Broadcast session deletion to all clients
function broadcastSessionDeleted(sessionId: string) {
  const message = JSON.stringify({
    type: 'session_deleted',
    sessionId,
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        wsClients.delete(client);
      }
    }
  }
}

// CORS headers
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Helper to read request body
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Helper to send JSON response
function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, corsHeaders);
  res.end(JSON.stringify(data));
}

// Create HTTP server
const server = createServer(async (req, res) => {
  const { pathname, query } = parse(req.url || '', true);
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  try {
    // POST /events - Receive new events
    if (pathname === '/events' && method === 'POST') {
      const body = await readBody(req);
      const data = JSON.parse(body) as EventPayload;
      const event = store.insert(data);
      broadcastEvent(event);
      sendJson(res, { success: true, id: event.id });
      return;
    }

    // GET /events/recent - Get recent events
    if (pathname === '/events/recent' && method === 'GET') {
      const limit = parseInt(query.limit as string || '100');
      const offset = parseInt(query.offset as string || '0');
      const filters = {
        source_app: query.source_app as string | undefined,
        session_id: query.session_id as string | undefined,
        hook_event_type: query.event_type as string | undefined,
      };
      const events = store.getRecent(limit, offset, filters);
      sendJson(res, events);
      return;
    }

    // GET /events/filter-options - Get available filters
    if (pathname === '/events/filter-options' && method === 'GET') {
      const options = store.getFilterOptions();
      sendJson(res, options);
      return;
    }

    // GET /stats - Get statistics
    if (pathname === '/stats' && method === 'GET') {
      const sessionId = query.session_id as string | undefined;
      const stats = store.getStats(sessionId);
      sendJson(res, stats);
      return;
    }

    // GET /health - Health check
    if (pathname === '/health') {
      sendJson(res, { status: 'ok', clients: wsClients.size, events: store.getRecent(1).length > 0 });
      return;
    }

    // DELETE /sessions/:sessionId - Delete a session and all its events
    if (pathname?.startsWith('/sessions/') && method === 'DELETE') {
      const sessionId = pathname.replace('/sessions/', '');

      if (!sessionId) {
        sendJson(res, { error: 'Session ID required' }, 400);
        return;
      }

      try {
        const result = store.deleteSession(sessionId);

        // Broadcast deletion to WebSocket clients
        broadcastSessionDeleted(sessionId);

        sendJson(res, {
          success: true,
          sessionId,
          deletedEvents: result.deletedEvents,
        });
      } catch (e) {
        sendJson(res, { error: String(e) }, 500);
      }
      return;
    }

    // 404 for unknown routes
    sendJson(res, { error: 'Not Found' }, 404);
  } catch (e) {
    console.error('Request error:', e);
    sendJson(res, { error: String(e) }, 500);
  }
});

// WebSocket server on /stream path
const wss = new WebSocketServer({ server, path: '/stream' });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', clients: wsClients.size }));
  console.log(`[WS] Client connected. Total: ${wsClients.size}`);

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${wsClients.size}`);
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      // Ignore invalid messages
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
    wsClients.delete(ws);
  });
});

// Start server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║    Mbwiller Local Claude Command Center - Server v2.0         ║
╠═══════════════════════════════════════════════════════════════╣
║  HTTP Server:    http://localhost:${PORT}                         ║
║  WebSocket:      ws://localhost:${PORT}/stream                    ║
║                                                               ║
║  Endpoints:                                                   ║
║    POST   /events          - Receive hook events              ║
║    GET    /events/recent   - Get recent events                ║
║    GET    /events/filter-options - Get filter values          ║
║    GET    /stats           - Get statistics                   ║
║    DELETE /sessions/:id    - Delete session & events          ║
║    GET    /health          - Health check                     ║
║    WS     /stream          - Real-time event stream           ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});
