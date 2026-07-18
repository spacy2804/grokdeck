use anyhow::{Context, Result};
use dirs::home_dir;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Application settings, persisted to ~/.grokdeck/settings.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Path to the `grok` binary. None = auto-detect from PATH
    pub grok_binary_path: Option<String>,
    /// Default working directory for new sessions
    pub default_cwd: Option<String>,
    /// Theme: "dark" | "light" | "system"
    pub theme: String,
    /// Default model ID
    pub default_model: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            grok_binary_path: None,
            default_cwd: None,
            theme: "dark".to_string(),
            default_model: None,
        }
    }
}

pub fn grokdeck_dir() -> PathBuf {
    home_dir()
        .expect("Cannot find home directory")
        .join(".grokdeck")
}

pub fn settings_path() -> PathBuf {
    grokdeck_dir().join("settings.json")
}

pub fn load_settings() -> Settings {
    let path = settings_path();
    if !path.exists() {
        return Settings::default();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_settings(settings: &Settings) -> Result<()> {
    let dir = grokdeck_dir();
    std::fs::create_dir_all(&dir)
        .context("Failed to create ~/.grokdeck directory")?;
    let content = serde_json::to_string_pretty(settings)
        .context("Failed to serialize settings")?;
    std::fs::write(settings_path(), content)
        .context("Failed to write settings.json")?;
    Ok(())
}

/// Resolve the grok binary path:
/// 1. Use settings.grok_binary_path if set and exists
/// 2. Search PATH via which::which
/// 3. Fallback to well-known install locations (grok installer puts binary in ~/.grok/bin)
pub fn resolve_grok_binary(settings: &Settings) -> Result<String> {
    if let Some(ref path) = settings.grok_binary_path {
        if !path.is_empty() {
            let p = PathBuf::from(path);
            if p.exists() {
                return Ok(path.clone());
            }
        }
    }

    // Try PATH lookup
    for name in &["grok", "xai-grok-pager"] {
        if let Ok(path) = which::which(name) {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    // Fallback: check well-known install locations from the official installer
    // (curl -fsSL https://x.ai/cli/install.sh | bash → installs to ~/.grok/bin/grok)
    let home = home_dir().unwrap_or_else(|| PathBuf::from("/root"));
    for candidate in &[
        home.join(".grok").join("bin").join("grok"),
        home.join(".local").join("bin").join("grok"),
        PathBuf::from("/usr/local/bin/grok"),
        PathBuf::from("/usr/bin/grok"),
    ] {
        if candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    anyhow::bail!(
        "Could not find 'grok' binary. \
         The official installer places it at ~/.grok/bin/grok. \
         Please set the binary path in Settings."
    )
}
