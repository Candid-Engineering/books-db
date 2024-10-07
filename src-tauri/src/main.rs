// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
pub mod plugins;

fn main() {
    if env::var("RUST_LOG").is_err() {
        env::set_var("RUST_LOG", "debug")
    }
    pretty_env_logger::init();

    tauri::Builder::default()
        // TODO(rkofman): remove this commented-out code. It was just me playing around with the default
        // `sql` plugin. Leaving here just to have a brief record of the attempt.
        // .plugin(
        //     tauri_plugin_sql::Builder::default()
        //         .add_migrations("sqlite:books-dev.db", db::migrations::get_all_tauri())
        //         .build(),
        // )
        // TODO(rkofman): the name of the DB should be updated based on `.env` variables.
        // `books.db` for prod, `books-dev.db` for dev, and probably `:memory:` for test.
        .plugin(plugins::sqlite_proxy::init("books-dev.db"))
        // .setup(|app| {
        //     tauri::async_runtime::block_on(async move {
        //         db::migrations::revert(app, "sqlite:books-dev.db", 0).await?;
        //         Ok(())
        //     })
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
