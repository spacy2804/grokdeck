mod bridge;
mod commands;
mod store;

use std::sync::Arc;
use tokio::sync::Mutex;

use bridge::process::{ActiveProcesses, new_active_processes};
use store::settings::{Settings, load_settings};

/// Application-wide shared state (managed by Tauri)
pub struct AppState {
    /// Running grok agent processes keyed by frontend thread_id
    pub active_processes: ActiveProcesses,
    /// Current settings (in-memory; persisted on save)
    pub settings: Arc<Mutex<Settings>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let settings = Arc::new(Mutex::new(load_settings()));
    let active_processes = new_active_processes();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState { active_processes, settings })
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings::get_settings,
            commands::settings::cmd_save_settings,
            commands::settings::check_grok_binary,
            commands::settings::pick_directory,
            // Workspaces
            commands::workspace::get_workspaces,
            commands::workspace::ensure_default_workspace,
            commands::workspace::cmd_create_workspace,
            commands::workspace::cmd_update_workspace,
            commands::workspace::cmd_delete_workspace,
            // Sessions
            commands::session_cmd::cmd_list_sessions,
            commands::session_cmd::cmd_search_sessions,
            commands::session_cmd::cmd_delete_session,
            commands::session_cmd::cmd_load_chat_history,
            // Agent
            commands::agent::cmd_start_agent,
            commands::agent::cmd_resume_agent,
            commands::agent::cmd_stop_agent,
            commands::agent::cmd_get_session_id,
            // Auth
            commands::auth::check_auth_status,
            commands::auth::trigger_grok_login,
            commands::auth::trigger_grok_logout,
            // Install
            commands::install::cmd_check_latest_version,
            commands::install::cmd_install_grok_cli,
            // File utils
            commands::file_utils::read_file_as_data_uri,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
