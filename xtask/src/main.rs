extern crate directories;
extern crate duct;

use duct::cmd;
use std::{env, fs::remove_file, path::PathBuf};
use tauri::utils::platform::Target;

use log::{error, info};

fn main() {
    if env::var("RUST_LOG").is_err() {
        env::set_var("RUST_LOG", "debug")
    }
    pretty_env_logger::init();

    info!("Running script...");
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Please provide a command.");
        return;
    }

    let command = &args[1];
    match command.as_str() {
        "db:drop" => {
            let db_path = get_full_db_path();
            match remove_file(&db_path) {
              Ok(_) => info!("Successfully deleted database file at: '{}'", db_path.display().to_string()),
              Err(_e) => {
                error!("⚠️ Could not find database at: '{}'.", db_path.display().to_string());
                error!("  🤔 Is it already dropped?");
                error!("  🤔 Do you have permissions?");
                error!("  🤔 Is it the correct path?");
            }
            };
        }
        "gen:migration" => {
            if args.len() < 3 {
                eprintln!("Please provide migration name: `cargo xtask gen:migration [name]`");
                return;
            }
            let command = cmd!(
                "pnpm",
                "drizzle-kit",
                "generate",
                format!("--name={}", args[2]),
            );

            let result = command.stderr_to_stdout().run().unwrap();

            if !result.status.success() {
                error!("Failed to generate migration!");
            }
        }
        _ => {
            error!("Unknown command: {}", command);
        }
    }
}

fn get_full_db_path() -> PathBuf {
    // TODO(rkofman): replace this with a dynamic value, perhaps stored in a plugin configuration.
    let db_filename = "books-dev.db";
    let tauri_config_path = "./src-tauri/tauri.conf.json";
    let config = tauri::utils::config::parse(Target::current(), tauri_config_path).expect(
        format!(
            "This script must be run from project root! Can't find {}",
            tauri_config_path
        )
        .as_str(),
    );
    let app_identifier = &config.0.identifier;
    let project_dirs = directories::ProjectDirs::from_path(app_identifier.into()).unwrap();
    let app_data_path = project_dirs.data_dir();

    return app_data_path.join(db_filename);
}
