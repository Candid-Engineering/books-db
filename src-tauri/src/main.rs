// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
pub mod db;
pub mod plugins;

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:books-dev.db", db::migrations::get_all_tauri())
                .build(),
        )
        .setup(|app| {
            tauri::async_runtime::block_on(async move {
                db::migrations::revert(app, "sqlite:books-dev.db", 0).await?;
                Ok(())
            })
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
