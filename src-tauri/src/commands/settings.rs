use tauri::State;
use crate::AppState;
use crate::store::settings::{Settings, save_settings, resolve_grok_binary};

/// Get current app settings
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    Ok(state.settings.lock().await.clone())
}

/// Save settings to disk and update in-memory state
#[tauri::command]
pub async fn cmd_save_settings(
    settings: Settings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    save_settings(&settings).map_err(|e| e.to_string())?;
    *state.settings.lock().await = settings;
    Ok(())
}

/// Check the grok binary: run `grok --version` and return the version string.
/// Returns an error if the binary is not found or fails to run.
#[tauri::command]
pub async fn check_grok_binary(state: State<'_, AppState>) -> Result<String, String> {
    let settings = state.settings.lock().await.clone();
    let bin = resolve_grok_binary(&settings).map_err(|e| e.to_string())?;

    let output = tokio::process::Command::new(&bin)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Failed to run '{bin}': {e}"))?;

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        // Some builds write version to stderr
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Ok(if stderr.is_empty() { format!("{bin} (version unknown)") } else { stderr })
    } else {
        Ok(version)
    }
}

/// Open a native directory picker dialog and return the selected path.
#[tauri::command]
pub async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog().file().blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}
