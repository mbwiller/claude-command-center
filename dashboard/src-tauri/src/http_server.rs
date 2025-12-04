/**
 * HTTP Server Module for Claude Code Command Center
 *
 * Receives events from Python hooks via POST /events
 * and emits them to the Tauri frontend via event system.
 */

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

/// Event structure matching the Python hook payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEvent {
    pub source_app: String,
    pub session_id: String,
    pub hook_event_type: String,
    pub timestamp: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

/// Stored event with database-style ID
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredEvent {
    pub id: u64,
    pub source_app: String,
    pub session_id: String,
    pub hook_event_type: String,
    pub timestamp: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}

/// Server state shared across handlers
pub struct ServerState {
    app_handle: AppHandle,
    events: RwLock<Vec<StoredEvent>>,
    next_id: RwLock<u64>,
}

impl ServerState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            events: RwLock::new(Vec::new()),
            next_id: RwLock::new(1),
        }
    }
}

/// Health check endpoint
async fn health() -> &'static str {
    "OK"
}

/// Get recent events endpoint
async fn get_recent_events(
    State(state): State<Arc<ServerState>>,
) -> Json<Vec<StoredEvent>> {
    let events = state.events.read().await;
    // Return events in reverse chronological order (newest first)
    let mut result: Vec<StoredEvent> = events.iter().rev().take(500).cloned().collect();
    result.reverse();
    Json(result)
}

/// Receive event from Python hooks
async fn receive_event(
    State(state): State<Arc<ServerState>>,
    Json(event): Json<HookEvent>,
) -> StatusCode {
    // Generate ID and timestamp
    let mut next_id = state.next_id.write().await;
    let id = *next_id;
    *next_id += 1;
    drop(next_id);

    let stored_event = StoredEvent {
        id,
        source_app: event.source_app,
        session_id: event.session_id,
        hook_event_type: event.hook_event_type,
        timestamp: event.timestamp,
        payload: event.payload,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    // Store event
    {
        let mut events = state.events.write().await;
        events.push(stored_event.clone());
        // Keep only last 1000 events in memory
        let len = events.len();
        if len > 1000 {
            events.drain(0..len - 1000);
        }
    }

    // Emit to frontend via Tauri event system
    let emit_payload = serde_json::json!({
        "type": "event",
        "data": stored_event
    });

    if let Err(e) = state.app_handle.emit("new-event", emit_payload) {
        log::error!("Failed to emit event to frontend: {}", e);
    }

    log::info!("Received event: {} from {}", stored_event.hook_event_type, stored_event.source_app);

    StatusCode::CREATED
}

/// Delete a session and its events
async fn delete_session(
    State(state): State<Arc<ServerState>>,
    axum::extract::Path(session_id): axum::extract::Path<String>,
) -> StatusCode {
    {
        let mut events = state.events.write().await;
        events.retain(|e| e.session_id != session_id);
    }

    // Notify frontend
    let emit_payload = serde_json::json!({
        "type": "session_deleted",
        "sessionId": session_id
    });

    let _ = state.app_handle.emit("session-deleted", emit_payload);

    StatusCode::OK
}

/// Clear all events
async fn clear_events(
    State(state): State<Arc<ServerState>>,
) -> StatusCode {
    {
        let mut events = state.events.write().await;
        events.clear();
    }

    // Reset ID counter
    {
        let mut next_id = state.next_id.write().await;
        *next_id = 1;
    }

    // Notify frontend
    let emit_payload = serde_json::json!({
        "type": "events_cleared"
    });

    let _ = state.app_handle.emit("events-cleared", emit_payload);

    StatusCode::OK
}

/// Check if a port is available
fn is_port_available(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Start the HTTP server on the specified port
pub async fn start_server(app_handle: AppHandle, preferred_port: u16) -> Result<u16, String> {
    // Check if preferred port is available
    let port = if is_port_available(preferred_port) {
        preferred_port
    } else {
        log::warn!("Port {} is in use, finding alternative...", preferred_port);
        // Try ports 4001-4010
        (4001..=4010)
            .find(|&p| is_port_available(p))
            .ok_or_else(|| "No available ports found in range 4000-4010".to_string())?
    };

    let state = Arc::new(ServerState::new(app_handle.clone()));

    // Configure CORS to allow requests from any origin (for WebSocket fallback)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/events", post(receive_event))
        .route("/events/recent", get(get_recent_events))
        .route("/sessions/:session_id", axum::routing::delete(delete_session))
        .route("/events/clear", post(clear_events))
        .layer(cors)
        .with_state(state);

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    log::info!("HTTP server listening on http://{}", addr);

    // Emit server status to frontend
    let _ = app_handle.emit("server-status", serde_json::json!({
        "status": "online",
        "port": port
    }));

    // Spawn the server
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("Server error: {}", e);
        }
    });

    Ok(port)
}
