use base64::Engine;
use std::path::Path;
use tauri::command;

/// Read a local file and return it as a base64 data URI.
/// Returns `data:<mime>;base64,<encoded>` or an error string.
#[command]
pub async fn read_file_as_data_uri(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let data = std::fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let mime = mime_from_extension(path.extension().and_then(|e| e.to_str()).unwrap_or(""));

    let encoded = base64::engine::general_purpose::STANDARD.encode(&data);

    Ok(format!("data:{};base64,{}", mime, encoded))
}

fn mime_from_extension(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "tiff" | "tif" => "image/tiff",
        _ => "application/octet-stream",
    }
}
