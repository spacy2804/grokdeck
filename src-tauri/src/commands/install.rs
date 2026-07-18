use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncBufReadExt;

use crate::AppState;
use crate::store::settings::save_settings;

const INSTALL_SCRIPT_URL: &str = "https://x.ai/cli/install.sh";
const VERSION_URL: &str = "https://x.ai/cli/stable";

/// Information about the latest available Grok CLI release.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub version: String,
    pub download_url: String,
    pub sha256_url: Option<String>,
    pub size: Option<u64>,
}

/// Progress event emitted during installation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    stage: &'static str,
    downloaded: u64,
    total: u64,
    percent: u8,
    message: String,
}

/// Check the latest available version of the Grok CLI.
/// Fetches the plain-text version from the official stable channel endpoint.
#[tauri::command]
pub async fn cmd_check_latest_version() -> Result<ReleaseInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("GrokDeck/0.1")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let resp = client
        .get(VERSION_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest version: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Could not fetch latest Grok CLI version (HTTP {}). Check your internet connection.",
            resp.status()
        ));
    }

    let version = resp
        .text()
        .await
        .map(|t| t.trim().to_string())
        .map_err(|e| format!("Failed to read version response: {e}"))?;

    if version.is_empty() {
        return Err("Received empty version response from server.".to_string());
    }

    Ok(ReleaseInfo {
        version,
        // The actual download is handled by the official install.sh script.
        download_url: INSTALL_SCRIPT_URL.to_string(),
        sha256_url: None,
        size: None,
    })
}

/// Install the Grok CLI by running the official install script:
///   curl -fsSL https://x.ai/cli/install.sh | bash
///
/// Streams each line of output as an `install:progress` event so the
/// frontend can show live feedback.
#[tauri::command]
pub async fn cmd_install_grok_cli(
    _release: ReleaseInfo,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (cmd_program, cmd_args) = if cfg!(target_os = "windows") {
        (
            "powershell".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-Command".to_string(),
                "irm https://x.ai/cli/install.ps1 | iex".to_string(),
            ],
        )
    } else {
        // Verify that curl is available on Unix
        which::which("curl").map_err(|_| {
            "curl is required but not found. Please install curl and try again.".to_string()
        })?;
        (
            "bash".to_string(),
            vec![
                "-c".to_string(),
                format!("curl -fsSL '{INSTALL_SCRIPT_URL}' | bash"),
            ],
        )
    };

    emit_progress(&app_handle, "downloading", 0, 0, 0, "Running official Grok CLI installer…");

    // Run the installer command, capture stdout + stderr line-by-line
    let mut child = tokio::process::Command::new(cmd_program)
        .args(cmd_args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start installer: {e}"))?;

    // Stream stderr (installer writes progress to stderr)
    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to capture installer output")?;

    let app_handle_clone = app_handle.clone();
    let stderr_task = tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim().to_string();
            if !trimmed.is_empty() {
                emit_progress(&app_handle_clone, "downloading", 0, 0, 50, &trimmed);
            }
        }
    });

    // Also stream stdout
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture installer stdout")?;

    let app_handle_clone2 = app_handle.clone();
    let stdout_task = tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim().to_string();
            if !trimmed.is_empty() {
                emit_progress(&app_handle_clone2, "downloading", 0, 0, 50, &trimmed);
            }
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Installer process error: {e}"))?;

    let _ = tokio::join!(stderr_task, stdout_task);

    if !status.success() {
        let code = status.code().unwrap_or(-1);
        return Err(format!(
            "Grok CLI installer exited with error code {code}. \
             Try running the official installer script manually."
        ));
    }

    emit_progress(&app_handle, "verifying", 0, 0, 90, "Verifying installation…");

    // Find the installed binary (install.sh puts it in ~/.grok/bin/grok, install.ps1 puts it in ~/.grok/bin/grok.exe)
    let bin_name = if cfg!(target_os = "windows") { "grok.exe" } else { "grok" };
    let grok_bin = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".grok")
        .join("bin")
        .join(bin_name);

    // Fallback: search PATH
    let grok_path = if grok_bin.exists() {
        grok_bin
    } else {
        which::which("grok")
            .map_err(|_| "Installation finished but `grok` binary not found. You may need to restart your shell.".to_string())?
    };

    // Run `grok --version` to confirm
    let version_output = tokio::process::Command::new(&grok_path)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Binary found but failed to run: {e}"))?;

    let version = if version_output.status.success() {
        let out = String::from_utf8_lossy(&version_output.stdout).trim().to_string();
        if out.is_empty() {
            String::from_utf8_lossy(&version_output.stderr).trim().to_string()
        } else {
            out
        }
    } else {
        "unknown".to_string()
    };

    // Save binary path to settings
    let bin_path_str = grok_path.to_string_lossy().to_string();
    {
        let mut settings = state.settings.lock().await;
        settings.grok_binary_path = Some(bin_path_str.clone());
        save_settings(&settings)
            .map_err(|e| format!("Installed OK but failed to save settings: {e}"))?;
    }

    emit_progress(&app_handle, "done", 0, 0, 100, &format!("Grok CLI installed: {version}"));

    Ok(version)
}

// --- Helper ---

fn emit_progress(
    app_handle: &AppHandle,
    stage: &'static str,
    downloaded: u64,
    total: u64,
    percent: u8,
    message: &str,
) {
    let _ = app_handle.emit(
        "install:progress",
        InstallProgress {
            stage,
            downloaded,
            total,
            percent,
            message: message.to_string(),
        },
    );
}
