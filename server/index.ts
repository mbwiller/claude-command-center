/**
 * Claude Code Command Center - Observability Server
 * Bun TypeScript server for receiving and streaming events
 *
 * SIMPLIFIED: Only core event tracking, no protocol compliance features
 */

import { Database } from "bun:sqlite";

// Types
interface Event {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  timestamp: string;
  payload: string;
  created_at?: string;
}

interface EventPayload {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

// Database setup
const db = new Database("events.db");

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_app TEXT NOT NULL,
    session_id TEXT NOT NULL,
    hook_event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_events_source_app ON events(source_app)`);

// WebSocket clients for real-time streaming
const wsClients = new Set<WebSocket>();

// Broadcast event to all connected clients
function broadcastEvent(event: Event) {
  const message = JSON.stringify({
    type: "event",
    data: {
      ...event,
      payload: typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload,
    },
  });

  for (const client of wsClients) {
    try {
      client.send(message);
    } catch (e) {
      wsClients.delete(client);
    }
  }
}

// Broadcast session deletion to all connected clients
function broadcastSessionDeleted(sessionId: string) {
  const message = JSON.stringify({
    type: "session_deleted",
    sessionId,
  });

  for (const client of wsClients) {
    try {
      client.send(message);
    } catch (e) {
      wsClients.delete(client);
    }
  }
}

// Delete a session and all related events
function deleteSession(sessionId: string): { success: boolean; deletedEvents: number } {
  const deleteEvents = db.prepare("DELETE FROM events WHERE session_id = ?");
  const result = deleteEvents.run(sessionId);
  return {
    success: true,
    deletedEvents: result.changes,
  };
}

// Insert event into database
function insertEvent(event: EventPayload): Event {
  const stmt = db.prepare(`
    INSERT INTO events (source_app, session_id, hook_event_type, timestamp, payload)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    event.timestamp || new Date().toISOString(),
    JSON.stringify(event.payload || {})
  );

  return {
    id: Number(result.lastInsertRowid),
    source_app: event.source_app,
    session_id: event.session_id,
    hook_event_type: event.hook_event_type,
    timestamp: event.timestamp || new Date().toISOString(),
    payload: JSON.stringify(event.payload || {}),
  };
}

// Get recent events
function getRecentEvents(limit = 100, offset = 0, filters?: {
  source_app?: string;
  session_id?: string;
  hook_event_type?: string;
}) {
  let query = "SELECT * FROM events WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.source_app) {
    query += " AND source_app = ?";
    params.push(filters.source_app);
  }
  if (filters?.session_id) {
    query += " AND session_id = ?";
    params.push(filters.session_id);
  }
  if (filters?.hook_event_type) {
    query += " AND hook_event_type = ?";
    params.push(filters.hook_event_type);
  }

  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const events = stmt.all(...params) as Event[];

  return events.map((e) => ({
    ...e,
    payload: typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload,
  }));
}

// Get filter options
function getFilterOptions() {
  const sourceApps = db
    .prepare("SELECT DISTINCT source_app FROM events")
    .all() as { source_app: string }[];
  const sessionIds = db
    .prepare("SELECT DISTINCT session_id FROM events ORDER BY timestamp DESC LIMIT 50")
    .all() as { session_id: string }[];
  const eventTypes = db
    .prepare("SELECT DISTINCT hook_event_type FROM events")
    .all() as { hook_event_type: string }[];

  return {
    source_apps: sourceApps.map((r) => r.source_app),
    session_ids: sessionIds.map((r) => r.session_id),
    event_types: eventTypes.map((r) => r.hook_event_type),
  };
}

// Get session stats (real data only - no fake metrics)
function getSessionStats(sessionId?: string) {
  const query = sessionId
    ? "SELECT * FROM events WHERE session_id = ?"
    : "SELECT * FROM events";

  const events = (sessionId
    ? db.prepare(query).all(sessionId)
    : db.prepare(query).all()) as Event[];

  const stats = {
    total_events: events.length,
    by_type: {} as Record<string, number>,
    by_app: {} as Record<string, number>,
    sessions: new Set<string>(),
  };

  for (const event of events) {
    stats.by_type[event.hook_event_type] = (stats.by_type[event.hook_event_type] || 0) + 1;
    stats.by_app[event.source_app] = (stats.by_app[event.source_app] || 0) + 1;
    stats.sessions.add(event.session_id);
  }

  return {
    ...stats,
    sessions: stats.sessions.size,
  };
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Main server
const server = Bun.serve({
  port: 4000,

  fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // WebSocket upgrade for /stream
    if (path === "/stream") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // POST /events - Receive new events
    if (path === "/events" && method === "POST") {
      return (async () => {
        try {
          const body = await req.json() as EventPayload;
          const event = insertEvent(body);
          broadcastEvent(event);
          return Response.json({ success: true, id: event.id }, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 400, headers: corsHeaders });
        }
      })();
    }

    // GET /events/recent - Get recent events
    if (path === "/events/recent" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const filters = {
        source_app: url.searchParams.get("source_app") || undefined,
        session_id: url.searchParams.get("session_id") || undefined,
        hook_event_type: url.searchParams.get("event_type") || undefined,
      };
      const events = getRecentEvents(limit, offset, filters);
      return Response.json(events, { headers: corsHeaders });
    }

    // GET /events/filter-options - Get available filters
    if (path === "/events/filter-options" && method === "GET") {
      const options = getFilterOptions();
      return Response.json(options, { headers: corsHeaders });
    }

    // GET /stats - Get statistics
    if (path === "/stats" && method === "GET") {
      const sessionId = url.searchParams.get("session_id") || undefined;
      const stats = getSessionStats(sessionId);
      return Response.json(stats, { headers: corsHeaders });
    }

    // Health check
    if (path === "/health") {
      return Response.json({ status: "ok", clients: wsClients.size }, { headers: corsHeaders });
    }

    // POST /events/clear - Clear all events (for fresh start)
    if (path === "/events/clear" && method === "POST") {
      try {
        db.run("DELETE FROM events");
        // Notify all connected clients
        const message = JSON.stringify({ type: "events_cleared" });
        for (const client of wsClients) {
          try {
            client.send(message);
          } catch (e) {
            wsClients.delete(client);
          }
        }
        return Response.json({ success: true, message: "All events cleared" }, { headers: corsHeaders });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
      }
    }

    // DELETE /sessions/:sessionId - Delete a session and all events
    if (method === "DELETE" && path.startsWith("/sessions/")) {
      const sessionId = path.replace("/sessions/", "");

      if (!sessionId) {
        return Response.json(
          { error: "Session ID required" },
          { status: 400, headers: corsHeaders }
        );
      }

      try {
        const result = deleteSession(sessionId);
        broadcastSessionDeleted(sessionId);

        return Response.json(
          {
            success: true,
            sessionId,
            deletedEvents: result.deletedEvents,
          },
          { headers: corsHeaders }
        );
      } catch (e) {
        return Response.json(
          { error: String(e) },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 404 for unknown routes
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },

  websocket: {
    open(ws) {
      wsClients.add(ws);
      ws.send(JSON.stringify({ type: "connected", clients: wsClients.size }));
      console.log(`WebSocket client connected. Total: ${wsClients.size}`);
    },

    close(ws) {
      wsClients.delete(ws);
      console.log(`WebSocket client disconnected. Total: ${wsClients.size}`);
    },

    message(ws, message) {
      try {
        const data = JSON.parse(String(message));
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        // Ignore invalid messages
      }
    },
  },
});

console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║       Claude Code Command Center - Session Monitor                     ║
╠════════════════════════════════════════════════════════════════════════╣
║  HTTP Server:    http://localhost:${server.port}                              ║
║  WebSocket:      ws://localhost:${server.port}/stream                         ║
║                                                                        ║
║  Endpoints:                                                            ║
║    POST   /events              - Receive hook events                   ║
║    GET    /events/recent       - Get recent events                     ║
║    GET    /events/filter-options - Get filter values                   ║
║    GET    /stats               - Get statistics                        ║
║    DELETE /sessions/:id        - Delete session & events               ║
║    GET    /health              - Health check                          ║
║    WS     /stream              - Real-time event stream                ║
╚════════════════════════════════════════════════════════════════════════╝
`);
