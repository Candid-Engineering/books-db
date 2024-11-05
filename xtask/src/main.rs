extern crate directories;
extern crate duct;

use duct::cmd;
use std::env;

use log::{error, info};
use tauri::utils::platform::Target;

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
        "gen:schema" => {
            // TODO(rkofman): replace this with a value gotten from a plugin configuration.
            let db_filename = "books-dev.db";

            let tauri_config_path = "./src-tauri/tauri.conf.json";
            let config = tauri::utils::config::parse(Target::current(), tauri_config_path)
                .expect("This script must be run from project root!");
            let app_identifier = &config.0.identifier;
            let project_dirs = directories::ProjectDirs::from_path(app_identifier.into()).unwrap();
            let app_data_path = project_dirs.data_dir();

            let full_db_path = app_data_path.join(db_filename);
            info!("Trying to load db from: {:?}", &full_db_path);

            info!("Checking if directory exists: {:?}", full_db_path.parent());

            let command = cmd!(
                "pnpm",
                "drizzle-kit",
                "pull",
                "--dialect=sqlite",
                format!("--url={}", full_db_path.to_string_lossy()),
                "--out=src-ui/lib/drizzle"
            );

            let result = command.stderr_to_stdout().run().unwrap();

            if !result.status.success() {
                error!("Failed to generate schema!");
            }
        }
        _ => {
            error!("Unknown command: {}", command);
        }
    }
}
