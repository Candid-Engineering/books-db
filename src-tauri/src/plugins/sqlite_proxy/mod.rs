mod commands;
mod error;
mod json_param;
mod lib;
use std::sync::Mutex;

pub use commands::*;
pub use error::{Error, Res};
use lib::connection_for;
use specta_typescript::Typescript;
use tauri::plugin::Builder;
use tauri::plugin::PluginApi;
use tauri::plugin::TauriPlugin;
use tauri::AppHandle;
use tauri::Manager;
use tauri::Runtime;
use tauri::Wry;

pub fn init(
    filename: impl Into<String> + Send + 'static,
    migrations: &[Migration],
) -> TauriPlugin<Wry> {
    // typescript export builder
    let specta_builder = tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![query, query_row, execute])
        .plugin_name("sqlite-proxy");

    // typescript export happens during runtime, so should not happen on user machines.
    #[cfg(debug_assertions)] // <- Only export on non-release builds
    specta_builder
        .export(
            Typescript::default(),
            "../src-ui/lib/generated/sqlite_proxy.ts",
        )
        .expect("Failed to export typescript bindings");

    let migrations = migrations.to_vec(); // clones migrations to extend ownership.

    Builder::new("sqlite-proxy")
        .setup(move |app, api| {
            specta_builder.mount_events(app);
            setup(app, api, &filename.into(), &migrations)
        })
        .invoke_handler(tauri::generate_handler![query, query_row, execute])
        .build()
}

fn setup<R: Runtime>(
    app: &AppHandle<R>,
    _api: PluginApi<R, ()>,
    filename: &String,
    migrations: &[Migration],
) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let app_config_folder = app
        .path()
        .app_config_dir()
        .expect("Failed to get an app folder.");
    let connection = connection_for(&app_config_folder, &filename)?;
    apply_migrations(&connection, &migrations)?;
    app.manage(Mutex::new(connection));
    Ok(())
}
