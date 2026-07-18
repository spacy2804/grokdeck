use serde::{Deserialize, Serialize};

/// Raw event from `grok --output-format streaming-json`.
/// The actual CLI uses: text, thought, tool_use, tool_result, end, error, etc.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
enum RawGrokEvent {
    /// Streaming text chunk
    #[serde(rename = "text")]
    Text { data: String },
    /// Thinking/reasoning chunk
    #[serde(rename = "thought")]
    Thought { data: String },
    /// Agent is about to call a tool
    #[serde(rename = "tool_use")]
    ToolUse {
        id: Option<String>,
        name: Option<String>,
        input: Option<serde_json::Value>,
    },
    /// Result returned by a tool call
    #[serde(rename = "tool_result")]
    ToolResult {
        id: Option<String>,
        name: Option<String>,
        output: Option<String>,
        #[serde(default)]
        is_error: bool,
    },
    /// The agent turn has completed
    #[serde(rename = "end")]
    End {
        #[serde(rename = "stopReason")]
        _stop_reason: Option<String>,
        #[serde(rename = "sessionId")]
        session_id: Option<String>,
    },
    /// A fatal or non-fatal error occurred
    #[serde(rename = "error")]
    Error {
        code: Option<String>,
        message: Option<String>,
        data: Option<String>,
    },
    /// Status/lifecycle update
    #[serde(rename = "status")]
    Status {
        message: Option<String>,
        data: Option<String>,
    },
}

/// Normalized event emitted to the frontend via Tauri events.
/// The frontend listens for these using the `type` discriminant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GrokEvent {
    /// Streaming text chunk from the agent
    TextDelta { content: String },
    /// Thinking/reasoning chunk from the agent
    Thinking { content: String },
    /// Agent is about to call a tool
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    /// Result returned by a tool call
    ToolResult {
        id: String,
        name: String,
        output: Option<String>,
        #[serde(default)]
        is_error: bool,
    },
    /// The agent turn has completed
    TurnComplete {
        session_id: Option<String>,
    },
    /// A fatal or non-fatal error occurred
    Error {
        code: Option<String>,
        message: String,
    },
    /// Status/lifecycle update
    Status {
        message: String,
        state: String,
    },
}

/// Parse a single line of streaming JSON output from grok and normalize
/// it into the frontend-friendly GrokEvent format.
/// Returns None for empty or whitespace-only lines.
pub fn parse_line(line: &str) -> Option<Result<GrokEvent, serde_json::Error>> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Try to parse the raw event
    let raw: RawGrokEvent = match serde_json::from_str(trimmed) {
        Ok(r) => r,
        Err(e) => return Some(Err(e)),
    };

    // Normalize to frontend format
    let event = match raw {
        RawGrokEvent::Text { data } => GrokEvent::TextDelta { content: data },
        RawGrokEvent::Thought { data } => {
            // Forward thinking/reasoning as a separate event type
            if data.is_empty() {
                return None;
            }
            GrokEvent::Thinking { content: data }
        }
        RawGrokEvent::ToolUse { id, name, input } => GrokEvent::ToolUse {
            id: id.unwrap_or_default(),
            name: name.unwrap_or_default(),
            input: input.unwrap_or(serde_json::Value::Object(Default::default())),
        },
        RawGrokEvent::ToolResult { id, name, output, is_error } => GrokEvent::ToolResult {
            id: id.unwrap_or_default(),
            name: name.unwrap_or_default(),
            output,
            is_error,
        },
        RawGrokEvent::End { session_id, .. } => GrokEvent::TurnComplete { session_id },
        RawGrokEvent::Error { code, message, data } => GrokEvent::Error {
            code,
            message: message.or(data).unwrap_or_else(|| "Unknown error".to_string()),
        },
        RawGrokEvent::Status { message, data } => GrokEvent::Status {
            message: message.or(data).unwrap_or_default(),
            state: "running".to_string(),
        },
    };

    Some(Ok(event))
}
