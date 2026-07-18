use anyhow::{Context, Result};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use super::event_types::{GrokEvent, parse_line};

/// A running grok agent process tracked by grokdeck
pub struct AgentProcess {
    pub child: Child,
    /// The grok session_id — populated when we receive a TurnComplete event
    pub session_id: Option<String>,
}

/// Shared map: thread_id (frontend UUID) → running AgentProcess
pub type ActiveProcesses = Arc<Mutex<HashMap<String, AgentProcess>>>;

pub fn new_active_processes() -> ActiveProcesses {
    Arc::new(Mutex::new(HashMap::new()))
}

/// Tauri event names for streaming updates to the frontend.
/// The thread_id is embedded in the event name so each tab listens to its own stream.
pub fn event_name(thread_id: &str) -> String {
    format!("agent:event:{thread_id}")
}
pub fn done_event_name(thread_id: &str) -> String {
    format!("agent:done:{thread_id}")
}

/// Spawn a new grok session.
///
/// Builds the command:
///   `grok -p "<prompt>" --output-format streaming-json --cwd <cwd> [--model <m>] [--resume <sid>]`
///
/// Streams stdout line-by-line, parses each line as a GrokEvent,
/// and emits it to the frontend via Tauri events on `agent:event:<thread_id>`.
pub async fn spawn_agent(
    grok_binary: &str,
    prompt: &str,
    cwd: &str,
    model: Option<&str>,
    resume_session_id: Option<&str>,
    app_handle: AppHandle,
    thread_id: String,
    active: ActiveProcesses,
) -> Result<()> {
    let mut cmd = Command::new(grok_binary);

    // Core flags
    cmd.arg("-p").arg(prompt)
        .arg("--output-format").arg("streaming-json")
        .arg("--cwd").arg(cwd)
        // Always approve tool calls in GUI mode (user sees output directly)
        .arg("--always-approve");

    if let Some(m) = model {
        cmd.arg("--model").arg(m);
    }

    if let Some(sid) = resume_session_id {
        cmd.arg("--resume").arg(sid);
    }

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()
        .with_context(|| format!("Failed to spawn grok binary: {grok_binary}"))?;

    let stdout = child.stdout.take()
        .context("Failed to capture grok stdout")?;

    // Spawn background task to stream stdout → Tauri events
    let handle = app_handle.clone();
    let tid = thread_id.clone();
    let active_clone = active.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    match parse_line(&line) {
                        Some(Ok(event)) => {
                            // If we got a session_id from TurnComplete, store it
                            if let GrokEvent::TurnComplete { session_id: Some(ref sid) } = event {
                                let mut procs = active_clone.lock().await;
                                if let Some(proc) = procs.get_mut(&tid) {
                                    proc.session_id = Some(sid.clone());
                                }
                            }
                            let _ = handle.emit(&event_name(&tid), &event);
                        }
                        Some(Err(e)) => {
                            // Forward unparseable lines as raw text delta
                            let _ = handle.emit(
                                &event_name(&tid),
                                &GrokEvent::TextDelta { content: line.clone() },
                            );
                            eprintln!("[grokdeck] parse error: {e} — line: {line}");
                        }
                        None => {} // blank line, skip
                    }
                }
                Ok(None) => break, // EOF
                Err(e) => {
                    eprintln!("[grokdeck] stdout read error: {e}");
                    break;
                }
            }
        }

        // Process ended — emit done event and clean up
        let _ = handle.emit(&done_event_name(&tid), ());
        active_clone.lock().await.remove(&tid);
    });

    // Store the process
    active.lock().await.insert(
        thread_id.clone(),
        AgentProcess { child, session_id: None },
    );

    Ok(())
}

/// Kill a running agent process by thread_id.
pub async fn kill_agent(active: &ActiveProcesses, thread_id: &str) -> Result<()> {
    let mut procs = active.lock().await;
    if let Some(proc) = procs.get_mut(thread_id) {
        proc.child.kill().await.context("Failed to kill grok process")?;
        procs.remove(thread_id);
        Ok(())
    } else {
        anyhow::bail!("No active agent for thread_id: {thread_id}")
    }
}

/// Get the grok session_id for a given thread (if available)
pub async fn get_session_id(active: &ActiveProcesses, thread_id: &str) -> Option<String> {
    active.lock().await
        .get(thread_id)
        .and_then(|p| p.session_id.clone())
}
