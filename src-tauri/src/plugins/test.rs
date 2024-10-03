use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

// the plugin custom command handlers if you choose to extend the API:

#[tauri::command]
// this will be accessible with `invoke('plugin:awesome|initialize')`.
// where `awesome` is the plugin name.
fn initialize() {}

#[tauri::command]
// this will be accessible with `invoke('plugin:awesome|do_something')`.
fn do_something() {}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("awesome")
        .invoke_handler(tauri::generate_handler![initialize, do_something])
        .build()
}
