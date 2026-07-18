// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Fix WebKitGTK EGL/GPU issues on Linux (especially Wayland + Intel).
    // These must be set before any GTK/WebKit initialization.
    #[cfg(target_os = "linux")]
    {
        use std::env;

        // Force X11 backend to avoid native Wayland EGL issues in WebKitGTK.
        if env::var("GDK_BACKEND").is_err() {
            env::set_var("GDK_BACKEND", "x11");
        }

        // Disable WebKit's DMA-BUF renderer which triggers EGL_BAD_PARAMETER
        // on systems where the bundled/system libEGL doesn't match the GPU driver.
        if env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }

        // Disable compositing mode to prevent GPU-accelerated rendering failures.
        if env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    grokdeck_lib::run()
}
