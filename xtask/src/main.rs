extern crate directories;
extern crate duct;

use duct::cmd;
use std::env;

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
