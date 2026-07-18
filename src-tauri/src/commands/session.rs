use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Raw summary.json structure as written by grok CLI
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
struct RawSummaryJson {
    info: RawSessionInfo,
    session_summary: String,
    created_at: String,
    updated_at: String,
    num_messages: usize,
    current_model_id: Option<String>,
    generated_title: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
struct RawSessionInfo {
    id: String,
    cwd: String,
}

/// Metadata for a single grok session — normalized for the frontend
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SessionSummary {
    pub session_id: String,
    pub summary: String,
    pub first_prompt: Option<String>,
    pub updated_at: String,
    pub created_at: String,
    pub cwd: String,
    pub num_messages: usize,
    pub branch: Option<String>,
    pub repo_name: Option<String>,
    pub worktree_label: Option<String>,
    pub model_id: Option<String>,
}

impl From<RawSummaryJson> for SessionSummary {
    fn from(raw: RawSummaryJson) -> Self {
        SessionSummary {
            session_id: raw.info.id,
            summary: raw.generated_title.unwrap_or(raw.session_summary.clone()),
            first_prompt: Some(raw.session_summary),
            updated_at: raw.updated_at,
            created_at: raw.created_at,
            cwd: raw.info.cwd,
            num_messages: raw.num_messages,
            model_id: raw.current_model_id,
            branch: None,
            repo_name: None,
            worktree_label: None,
        }
    }
}

/// Session info returned to frontend (summary + optional workspace_id mapping)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    #[serde(flatten)]
    pub summary: SessionSummary,
    /// Grokdeck-assigned workspace_id if the session's cwd matches a workspace
    pub workspace_id: Option<String>,
}

/// Resolve the grok home directory: $GROK_HOME or ~/.grok
pub fn grok_home() -> PathBuf {
    std::env::var("GROK_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .expect("Cannot find home directory")
                .join(".grok")
        })
}

/// Read all sessions from ~/.grok/sessions/ directory.
/// Structure: ~/.grok/sessions/<encoded_cwd>/<session_id>/summary.json
pub fn read_sessions_from_fs(limit: usize) -> Result<Vec<SessionSummary>> {
    let sessions_dir = grok_home().join("sessions");
    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions: Vec<(std::time::SystemTime, SessionSummary)> = vec![];

    // First level: CWD-encoded directories (e.g. %2Fhome%2Fuser)
    for cwd_entry in std::fs::read_dir(&sessions_dir)
        .context("Failed to read ~/.grok/sessions/")?
    {
        let cwd_entry = cwd_entry?;
        let cwd_path = cwd_entry.path();
        if !cwd_path.is_dir() {
            continue;
        }

        // Check if this directory itself is a session (has summary.json directly)
        let direct_summary = cwd_path.join("summary.json");
        if direct_summary.exists() {
            if let Some(summary) = try_read_summary(&direct_summary, &cwd_entry) {
                let mtime = cwd_entry.metadata()
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::UNIX_EPOCH);
                sessions.push((mtime, summary));
            }
            continue;
        }

        // Second level: session ID directories inside CWD folder
        let sub_entries = match std::fs::read_dir(&cwd_path) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for session_entry in sub_entries {
            let session_entry = match session_entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let session_path = session_entry.path();
            if !session_path.is_dir() {
                continue;
            }

            let summary_path = session_path.join("summary.json");
            if !summary_path.exists() {
                continue;
            }

            if let Some(summary) = try_read_summary(&summary_path, &session_entry) {
                let mtime = session_entry.metadata()
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::UNIX_EPOCH);
                sessions.push((mtime, summary));
            }
        }
    }

    // Sort by most recently modified first
    sessions.sort_by(|a, b| b.0.cmp(&a.0));

    Ok(sessions
        .into_iter()
        .take(limit)
        .map(|(_, s)| s)
        .collect())
}

/// Try to parse a summary.json file into a SessionSummary
fn try_read_summary(summary_path: &std::path::Path, dir_entry: &std::fs::DirEntry) -> Option<SessionSummary> {
    let content = std::fs::read_to_string(summary_path).ok()?;
    let raw: RawSummaryJson = serde_json::from_str(&content).ok()?;
    let mut summary: SessionSummary = raw.into();

    // If session_id not set, use directory name
    if summary.session_id.is_empty() {
        summary.session_id = dir_entry.file_name().to_string_lossy().to_string();
    }

    Some(summary)
}

/// List sessions, optionally filtering by workspace project_dir (cwd match)
pub fn list_sessions(
    workspace_project_dir: Option<&str>,
    limit: usize,
    workspaces: &[crate::store::workspace::Workspace],
) -> Result<Vec<SessionInfo>> {
    let all = read_sessions_from_fs(limit * 3)?; // fetch more for filtering

    let result: Vec<SessionInfo> = all
        .into_iter()
        .filter(|s| {
            // If workspace filter given, only include sessions whose cwd starts
            // with the workspace project_dir
            if let Some(dir) = workspace_project_dir {
                s.cwd.starts_with(dir)
            } else {
                true
            }
        })
        .take(limit)
        .map(|s| {
            // Find which workspace this session belongs to
            let workspace_id = workspaces.iter().find_map(|w| {
                w.project_dir.as_ref().and_then(|dir| {
                    if s.cwd.starts_with(dir.as_str()) {
                        Some(w.id.clone())
                    } else {
                        None
                    }
                })
            });
            SessionInfo { summary: s, workspace_id }
        })
        .collect();

    Ok(result)
}

/// Simple text search across session summaries and first_prompts
pub fn search_sessions(
    query: &str,
    limit: usize,
    workspaces: &[crate::store::workspace::Workspace],
) -> Result<Vec<SessionInfo>> {
    let all = read_sessions_from_fs(500)?;
    let q = query.to_lowercase();

    let matched: Vec<SessionInfo> = all
        .into_iter()
        .filter(|s| {
            s.summary.to_lowercase().contains(&q)
                || s.first_prompt
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&q)
                || s.cwd.to_lowercase().contains(&q)
        })
        .take(limit)
        .map(|s| {
            let workspace_id = workspaces.iter().find_map(|w| {
                w.project_dir.as_ref().and_then(|dir| {
                    if s.cwd.starts_with(dir.as_str()) {
                        Some(w.id.clone())
                    } else {
                        None
                    }
                })
            });
            SessionInfo { summary: s, workspace_id }
        })
        .collect();

    Ok(matched)
}

/// Delete a session by removing its directory from ~/.grok/sessions/
/// Scans 2 levels deep: sessions/<encoded_cwd>/<session_id>/
pub fn delete_session(session_id: &str) -> Result<()> {
    let sessions_dir = grok_home().join("sessions");
    if !sessions_dir.exists() {
        anyhow::bail!("Session not found: {session_id}");
    }

    // First check direct: sessions/<session_id>
    let direct = sessions_dir.join(session_id);
    if direct.exists() && direct.is_dir() {
        std::fs::remove_dir_all(&direct)
            .with_context(|| format!("Failed to delete session {session_id}"))?;
        return Ok(());
    }

    // Scan encoded_cwd directories for sessions/<encoded_cwd>/<session_id>
    for cwd_entry in std::fs::read_dir(&sessions_dir)
        .context("Failed to read ~/.grok/sessions/")?
    {
        let cwd_entry = cwd_entry?;
        let cwd_path = cwd_entry.path();
        if !cwd_path.is_dir() {
            continue;
        }
        let session_path = cwd_path.join(session_id);
        if session_path.exists() && session_path.is_dir() {
            std::fs::remove_dir_all(&session_path)
                .with_context(|| format!("Failed to delete session {session_id}"))?;
            return Ok(());
        }
    }

    anyhow::bail!("Session not found: {session_id}");
}


/// A single message from chat_history.jsonl, normalized for the frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryMessage {
    pub role: String,       // "user" | "assistant" | "tool_use" | "tool_result" | "thinking"
    pub content: String,
    /// For tool_use: tool name
    pub tool_name: Option<String>,
    /// For tool_use/tool_result: call ID
    pub tool_id: Option<String>,
}

/// Raw chat history entry from chat_history.jsonl
#[derive(Debug, Clone, Deserialize)]
struct RawChatEntry {
    #[serde(rename = "type")]
    entry_type: String,
    content: Option<serde_json::Value>,
    /// Only user messages with prompt_index are actual user prompts
    prompt_index: Option<usize>,
    /// For synthetic system reminders
    synthetic_reason: Option<String>,
    /// For reasoning entries
    summary: Option<Vec<serde_json::Value>>,
    /// For backend_tool_call
    kind: Option<serde_json::Value>,
    /// For tool_result
    tool_call_id: Option<String>,
}

/// Load chat history messages for a given session.
/// Reads chat_history.jsonl and returns user + assistant messages.
pub fn load_chat_history(session_id: &str) -> Result<Vec<ChatHistoryMessage>> {
    let sessions_dir = grok_home().join("sessions");

    // Find the session folder (could be at any CWD subfolder)
    let session_path = find_session_dir(&sessions_dir, session_id)
        .context(format!("Session not found: {session_id}"))?;

    let history_path = session_path.join("chat_history.jsonl");
    if !history_path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&history_path)
        .context("Failed to read chat_history.jsonl")?;

    let mut messages = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let entry: RawChatEntry = match serde_json::from_str(trimmed) {
            Ok(e) => e,
            Err(_) => continue,
        };

        match entry.entry_type.as_str() {
            "user" => {
                // Only include actual user prompts (have prompt_index, no synthetic_reason)
                if entry.prompt_index.is_none() || entry.synthetic_reason.is_some() {
                    continue;
                }
                let text = extract_user_text(&entry.content);
                // Strip <user_query> tags if present
                let text = text
                    .replace("<user_query>", "")
                    .replace("</user_query>", "")
                    .trim()
                    .to_string();
                if !text.is_empty() {
                    messages.push(ChatHistoryMessage {
                        role: "user".to_string(),
                        content: text,
                        tool_name: None,
                        tool_id: None,
                    });
                }
            }
            "reasoning" => {
                // Extract summary text from reasoning entries
                let summary_text = entry.summary.as_ref().map(|parts| {
                    parts.iter().filter_map(|p| {
                        p.as_object()
                            .and_then(|o| o.get("text"))
                            .and_then(|t| t.as_str())
                    }).collect::<Vec<_>>().join(" ")
                }).unwrap_or_default();
                if !summary_text.is_empty() {
                    messages.push(ChatHistoryMessage {
                        role: "thinking".to_string(),
                        content: summary_text,
                        tool_name: None,
                        tool_id: None,
                    });
                }
            }
            "backend_tool_call" => {
                // Extract tool type and action info
                if let Some(kind) = &entry.kind {
                    let tool_type = kind.get("tool_type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("unknown");
                    let action_summary = kind.get("action")
                        .and_then(|a| a.get("type"))
                        .and_then(|t| t.as_str())
                        .unwrap_or("");
                    let query = kind.get("action")
                        .and_then(|a| a.get("query"))
                        .and_then(|q| q.as_str())
                        .unwrap_or("");
                    let display = if !query.is_empty() {
                        format!("{}: {}", action_summary, query)
                    } else {
                        action_summary.to_string()
                    };
                    messages.push(ChatHistoryMessage {
                        role: "tool_use".to_string(),
                        content: display,
                        tool_name: Some(tool_type.to_string()),
                        tool_id: None,
                    });
                }
            }
            "tool_result" => {
                let output = entry.content
                    .as_ref()
                    .and_then(|c| c.as_str())
                    .unwrap_or("")
                    .to_string();
                messages.push(ChatHistoryMessage {
                    role: "tool_result".to_string(),
                    content: output,
                    tool_name: None,
                    tool_id: entry.tool_call_id.clone(),
                });
            }
            "assistant" => {
                if let Some(serde_json::Value::String(text)) = &entry.content {
                    if !text.is_empty() {
                        messages.push(ChatHistoryMessage {
                            role: "assistant".to_string(),
                            content: text.clone(),
                            tool_name: None,
                            tool_id: None,
                        });
                    }
                }
            }
            _ => {} // Skip system, url, open_page, image, etc.
        }
    }

    Ok(messages)
}

/// Extract text content from user message (handles both string and array-of-parts format)
fn extract_user_text(content: &Option<serde_json::Value>) -> String {
    match content {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Array(parts)) => {
            parts.iter().filter_map(|part| {
                if let serde_json::Value::Object(obj) = part {
                    if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
                        return obj.get("text").and_then(|t| t.as_str()).map(String::from);
                    }
                }
                None
            }).collect::<Vec<_>>().join("\n")
        }
        _ => String::new(),
    }
}

/// Find a session directory by ID across all CWD subfolders
fn find_session_dir(sessions_dir: &std::path::Path, session_id: &str) -> Option<PathBuf> {
    // Direct child
    let direct = sessions_dir.join(session_id);
    if direct.is_dir() && direct.join("summary.json").exists() {
        return Some(direct);
    }

    // Search in CWD subfolders
    let entries = std::fs::read_dir(sessions_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let candidate = path.join(session_id);
        if candidate.is_dir() && candidate.join("summary.json").exists() {
            return Some(candidate);
        }
    }

    None
}
