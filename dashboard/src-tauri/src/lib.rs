mod http_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start HTTP server for receiving events from Python hooks
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match http_server::start_server(app_handle, 4000).await {
                    Ok(port) => {
                        log::info!("Event server started on port {}", port);
                    }
                    Err(e) => {
                        log::error!("Failed to start event server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
