// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

use migrations::lib::get_migrations;

pub mod migrations;
pub mod plugins;

fn main() {
    if env::var("RUST_LOG").is_err() {
        env::set_var("RUST_LOG", "debug")
    }
    pretty_env_logger::init();

    tauri::Builder::default()
        // TODO(rkofman): the name of the DB should be updated based on `.env` variables.
        // `books.db` for prod, `books-dev.db` for dev, and probably `:memory:` for test.
        // Also: consider moving this to the config file (assuming per-env configs).
        .plugin(plugins::sqlite_proxy::init(
            "books-dev.db",
            &get_migrations(),
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
