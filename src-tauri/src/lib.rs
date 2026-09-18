// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::Mutex;
use tauri::Manager;

struct StartupFiles(Mutex<Vec<String>>);

fn collect_startup_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            if arg.starts_with('-') {
                return false;
            }
            let path = std::path::Path::new(arg);
            path.is_file()
                || path
                    .extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| {
                        matches!(
                            e.to_ascii_lowercase().as_str(),
                            "nte" | "txt" | "text" | "log"
                        )
                    })
        })
        .collect()
}

#[tauri::command]
fn take_startup_files(state: tauri::State<'_, StartupFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap_or_else(|e| e.into_inner()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(StartupFiles(Mutex::new(collect_startup_files())))
        .invoke_handler(tauri::generate_handler![take_startup_files])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // Force window/taskbar icon from the generated PNG (avoids stale embedded ico in dev).
                let _ = window.set_icon(tauri::include_image!("icons/icon.png"));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
