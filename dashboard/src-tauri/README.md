# Tauri Desktop Application

This directory contains the Tauri 2.x Rust backend for the Claude Code Command Center desktop application.

## Overview

The Tauri integration transforms the web-based dashboard into a native desktop application with:
- System tray support
- Native notifications
- Global keyboard shortcuts
- Embedded HTTP server for receiving hook events
- No separate server process required

## Architecture

```
src-tauri/
├── src/
│   ├── main.rs          # Application entry point
│   ├── lib.rs           # Tauri setup and configuration
│   └── http_server.rs   # Axum HTTP server for event reception
├── capabilities/        # Tauri permission capabilities
├── icons/              # Application icons
├── Cargo.toml          # Rust dependencies
├── tauri.conf.json     # Tauri configuration
└── build.rs            # Build script
```

## Dependencies

Key Rust crates used:

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.9.4 | Desktop framework |
| axum | 0.7 | HTTP server |
| tokio | 1.x | Async runtime |
| tower-http | 0.5 | CORS middleware |
| serde/serde_json | 1.x | JSON serialization |
| chrono | 0.4 | Timestamps |
| tauri-plugin-log | 2.x | Logging |

## Development

### Prerequisites

- Rust 1.77+ (install via https://rustup.rs/)
- Tauri CLI: `cargo install tauri-cli`

### Running in Development

```bash
# From dashboard directory
npm run tauri dev
```

This will:
1. Start the Vite dev server (frontend)
2. Compile and run the Rust backend
3. Open the native window

### Building for Production

```bash
# From dashboard directory
npm run tauri build
```

Output binaries are placed in `target/release/`.

## HTTP Server

The embedded HTTP server (Axum) receives events from Python hooks and forwards them to the frontend via Tauri's event system.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /events | Receive new events |
| GET | /events/recent | Get recent events |
| GET | /events/filter-options | Get filter values |
| POST | /events/clear | Clear all events |
| DELETE | /sessions/:id | Delete a session |
| GET | /stats | Get statistics |
| GET | /health | Health check |

### Port Selection

The server attempts ports 4000-4010, using the first available port. The selected port is communicated to the frontend via Tauri state.

### Event Flow

```
Python Hook (POST /events)
    ↓
Axum HTTP Server (http_server.rs)
    ↓
app_handle.emit("new-event", payload)
    ↓
Frontend listen('new-event') callback
    ↓
React state update
```

## Configuration

### tauri.conf.json

Key configuration options:

```json
{
  "productName": "Claude Code Command Center",
  "version": "2.0.0",
  "identifier": "com.mbwiller.claude-command-center",
  "app": {
    "windows": [{
      "width": 1400,
      "height": 900,
      "minWidth": 800,
      "minHeight": 600
    }]
  }
}
```

### Capabilities

Tauri 2.x uses a capability-based permission system. See `capabilities/` for permission definitions.

## Icons

Application icons should be placed in `icons/` directory:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Generate icons with:
```bash
npm run tauri icon /path/to/source-image.png
```

## Troubleshooting

### Port Already in Use

If port 4000 is occupied, the server will try ports 4001-4010. Check the console logs for the actual port being used.

### Build Failures

```bash
# Clean and rebuild
cargo clean
npm run tauri build
```

### WebView Issues

Tauri uses the OS native WebView. Ensure your system WebView is up to date:
- Windows: Edge WebView2
- macOS: WebKit (included)
- Linux: WebKitGTK

## Resources

- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Tauri API Reference](https://v2.tauri.app/reference/)
- [Axum Documentation](https://docs.rs/axum/)
- [Tokio Documentation](https://docs.rs/tokio/)
