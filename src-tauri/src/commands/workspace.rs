use crate::store::workspace::{
    Workspace, create_workspace, delete_workspace, load_workspaces, update_workspace,
};

/// Default workspace color (slate/neutral)
const DEFAULT_WORKSPACE_COLOR: &str = "#6b7280";

/// Return all workspaces, sorted by sort_order
#[tauri::command]
pub async fn get_workspaces() -> Result<Vec<Workspace>, String> {
    let mut ws = load_workspaces();
    ws.sort_by_key(|w| w.sort_order);
    Ok(ws)
}

/// Ensure a "Default" workspace exists. Creates one if no workspaces exist.
/// Returns the full workspace list (with default guaranteed to be present).
#[tauri::command]
pub async fn ensure_default_workspace() -> Result<Vec<Workspace>, String> {
    let mut ws = load_workspaces();
    if ws.is_empty() {
        let home = dirs::home_dir()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string());
        let default_ws = create_workspace(
            "Default".to_string(),
            DEFAULT_WORKSPACE_COLOR.to_string(),
            Some(home),
        )
        .map_err(|e| e.to_string())?;
        ws.push(default_ws);
    }
    ws.sort_by_key(|w| w.sort_order);
    Ok(ws)
}

/// Create a new workspace
#[tauri::command]
pub async fn cmd_create_workspace(
    name: String,
    color: String,
    project_dir: Option<String>,
) -> Result<Workspace, String> {
    create_workspace(name, color, project_dir).map_err(|e| e.to_string())
}

/// Update an existing workspace
#[tauri::command]
pub async fn cmd_update_workspace(
    id: String,
    name: String,
    color: String,
    project_dir: Option<String>,
) -> Result<Workspace, String> {
    update_workspace(id, name, color, project_dir).map_err(|e| e.to_string())
}

/// Delete a workspace by id
#[tauri::command]
pub async fn cmd_delete_workspace(id: String) -> Result<(), String> {
    delete_workspace(id).map_err(|e| e.to_string())
}
