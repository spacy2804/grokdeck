use crate::commands::session::{SessionInfo, ChatHistoryMessage, list_sessions, search_sessions, delete_session, load_chat_history};
use crate::store::workspace::load_workspaces;

/// List sessions. Pass workspace_id to filter by that workspace's project_dir.
#[tauri::command]
pub async fn cmd_list_sessions(
    workspace_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SessionInfo>, String> {
    let limit = limit.unwrap_or(30);
    let workspaces = load_workspaces();

    let project_dir = workspace_id.as_ref().and_then(|id| {
        workspaces.iter()
            .find(|w| &w.id == id)
            .and_then(|w| w.project_dir.clone())
    });

    list_sessions(project_dir.as_deref(), limit, &workspaces)
        .map_err(|e| e.to_string())
}

/// Search sessions by text query
#[tauri::command]
pub async fn cmd_search_sessions(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SessionInfo>, String> {
    let limit = limit.unwrap_or(20);
    let workspaces = load_workspaces();
    search_sessions(&query, limit, &workspaces).map_err(|e| e.to_string())
}

/// Delete a session from ~/.grok/sessions/
#[tauri::command]
pub async fn cmd_delete_session(session_id: String) -> Result<(), String> {
    delete_session(&session_id).map_err(|e| e.to_string())
}

/// Load chat history for a session
#[tauri::command]
pub async fn cmd_load_chat_history(session_id: String) -> Result<Vec<ChatHistoryMessage>, String> {
    load_chat_history(&session_id).map_err(|e| e.to_string())
}
