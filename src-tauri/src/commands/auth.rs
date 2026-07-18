use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::AppState;
use crate::store::settings::resolve_grok_binary;

/// Result of checking the user's authentication status.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthCheckResult {
    /// Whether any valid credential source was found.
    pub authenticated: bool,
    /// The auth method detected: "api_key", "session", or "none".
    pub method: String,
    /// Human-readable detail about the auth source.
    pub detail: Option<String>,
}

/// Resolve the grok home directory: $GROK_HOME or ~/.grok
fn grok_home() -> PathBuf {
    std::env::var("GROK_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .expect("Cannot find home directory")
                .join(".grok")
        })
}

/// Check if the user has valid grok credentials.
///
/// Checks in priority order:
/// 1. XAI_API_KEY environment variable
/// 2. ~/.grok/auth.json (or $GROK_AUTH_PATH) contains at least one scope
#[tauri::command]
pub async fn check_auth_status() -> Result<AuthCheckResult, String> {
    // Check 1: XAI_API_KEY env var
    if std::env::var("XAI_API_KEY").is_ok() {
        return Ok(AuthCheckResult {
            authenticated: true,
            method: "api_key".to_string(),
            detail: Some("Using XAI_API_KEY environment variable".to_string()),
        });
    }

    // Check 2: auth.json file
    let auth_path = std::env::var("GROK_AUTH_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| grok_home().join("auth.json"));

    if auth_path.exists() {
        match std::fs::read_to_string(&auth_path) {
            Ok(content) => {
                // Parse as JSON object and verify it has at least one scope entry
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if val.as_object().is_some_and(|m| !m.is_empty()) {
                        return Ok(AuthCheckResult {
                            authenticated: true,
                            method: "session".to_string(),
                            detail: Some("Signed in via browser".to_string()),
                        });
                    }
                }
            }
            Err(_) => {}
        }
    }

    Ok(AuthCheckResult {
        authenticated: false,
        method: "none".to_string(),
        detail: None,
    })
}

/// Trigger the `grok login` flow.
///
/// This spawns `grok login` which opens the user's browser for OAuth.
/// The device code printed to stdout/stderr is streamed back to the frontend
/// via `auth:output` Tauri events so the user can see it in the UI.
#[tauri::command]
pub async fn trigger_grok_login(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let settings = state.settings.lock().await.clone();
    let bin = resolve_grok_binary(&settings).map_err(|e| e.to_string())?;

    let mut child = tokio::process::Command::new(&bin)
        .arg("login")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run 'grok login': {e}"))?;

    // Stream stdout lines → auth:output events
    let stdout = child.stdout.take();
    let handle_out = app_handle.clone();
    let stdout_task = tokio::spawn(async move {
        if let Some(out) = stdout {
            let mut lines = tokio::io::BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = handle_out.emit("auth:output", line);
            }
        }
    });

    // Stream stderr lines → auth:output events (grok login writes code to stderr on some builds)
    let stderr = child.stderr.take();
    let handle_err = app_handle.clone();
    let stderr_task = tokio::spawn(async move {
        if let Some(err) = stderr {
            let mut lines = tokio::io::BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = handle_err.emit("auth:output", line);
            }
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("grok login process error: {e}"))?;

    let _ = tokio::join!(stdout_task, stderr_task);

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "Login process exited with code: {}",
            status.code().unwrap_or(-1)
        ))
    }
}


/// Trigger `grok logout` to clear cached credentials.
#[tauri::command]
pub async fn trigger_grok_logout(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    let bin = resolve_grok_binary(&settings).map_err(|e| e.to_string())?;

    let status = tokio::process::Command::new(&bin)
        .arg("logout")
        .status()
        .await
        .map_err(|e| format!("Failed to run 'grok logout': {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "Logout process exited with code: {}",
            status.code().unwrap_or(-1)
        ))
    }
}
