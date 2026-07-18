use tauri::{AppHandle, State};
use crate::AppState;
use crate::bridge::process::{spawn_agent, kill_agent, get_session_id};
use crate::store::settings::resolve_grok_binary;

/// Start a new agent session.
/// The frontend generates a thread_id (UUID) before calling this.
/// Events will be emitted on `agent:event:<thread_id>` and `agent:done:<thread_id>`.
#[tauri::command]
pub async fn cmd_start_agent(
    prompt: String,
    cwd: String,
    model: Option<String>,
    thread_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    let bin = resolve_grok_binary(&settings).map_err(|e| e.to_string())?;

    spawn_agent(
        &bin,
        &prompt,
        &cwd,
        model.as_deref(),
        None,
        app_handle,
        thread_id,
        state.active_processes.clone(),
    )
    .await
    .map_err(|e| e.to_string())
}

/// Resume an existing grok session with a new message.
#[tauri::command]
pub async fn cmd_resume_agent(
    session_id: String,
    message: String,
    cwd: String,
    model: Option<String>,
    thread_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    let bin = resolve_grok_binary(&settings).map_err(|e| e.to_string())?;

    spawn_agent(
        &bin,
        &message,
        &cwd,
        model.as_deref(),
        Some(&session_id),
        app_handle,
        thread_id,
        state.active_processes.clone(),
    )
    .await
    .map_err(|e| e.to_string())
}

/// Stop (kill) a running agent process.
#[tauri::command]
pub async fn cmd_stop_agent(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    kill_agent(&state.active_processes, &thread_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the grok session_id associated with a thread (if the turn has completed).
#[tauri::command]
pub async fn cmd_get_session_id(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    Ok(get_session_id(&state.active_processes, &thread_id).await)
}
