use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::settings::grokdeck_dir;

/// A workspace is a named group that organizes sessions by project directory.
/// Persisted to ~/.grokdeck/workspaces.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    /// Hex color for the workspace dot indicator, e.g. "#ef4444"
    pub color: String,
    /// Optional: path to the associated project directory
    pub project_dir: Option<String>,
    /// Unix timestamp seconds
    pub created_at: u64,
    /// Display sort order (lower = top)
    pub sort_order: usize,
}

fn workspaces_path() -> std::path::PathBuf {
    grokdeck_dir().join("workspaces.json")
}

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn load_workspaces() -> Vec<Workspace> {
    let path = workspaces_path();
    if !path.exists() {
        return vec![];
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_workspaces(workspaces: &[Workspace]) -> Result<()> {
    let dir = grokdeck_dir();
    std::fs::create_dir_all(&dir)
        .context("Failed to create ~/.grokdeck directory")?;
    let content = serde_json::to_string_pretty(workspaces)
        .context("Failed to serialize workspaces")?;
    std::fs::write(workspaces_path(), content)
        .context("Failed to write workspaces.json")?;
    Ok(())
}

pub fn create_workspace(name: String, color: String, project_dir: Option<String>) -> Result<Workspace> {
    let mut workspaces = load_workspaces();
    let sort_order = workspaces.len();
    let ws = Workspace {
        id: Uuid::new_v4().to_string(),
        name,
        color,
        project_dir,
        created_at: now_unix(),
        sort_order,
    };
    workspaces.push(ws.clone());
    save_workspaces(&workspaces)?;
    Ok(ws)
}

pub fn update_workspace(
    id: String,
    name: String,
    color: String,
    project_dir: Option<String>,
) -> Result<Workspace> {
    let mut workspaces = load_workspaces();
    let ws = workspaces
        .iter_mut()
        .find(|w| w.id == id)
        .context("Workspace not found")?;
    ws.name = name;
    ws.color = color;
    ws.project_dir = project_dir;
    let updated = ws.clone();
    save_workspaces(&workspaces)?;
    Ok(updated)
}

pub fn delete_workspace(id: String) -> Result<()> {
    let mut workspaces = load_workspaces();
    let before = workspaces.len();
    workspaces.retain(|w| w.id != id);
    if workspaces.len() == before {
        anyhow::bail!("Workspace not found: {id}");
    }
    save_workspaces(&workspaces)
}
