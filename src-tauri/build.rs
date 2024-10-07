use tauri_build::DefaultPermissionRule;

fn main() {
    let inline = tauri_build::InlinedPlugin::new()
        .commands(&["query", "migrate", "batch"])
        .default_permission(DefaultPermissionRule::AllowAllCommands);
    let attrs = tauri_build::Attributes::new().plugin(
        "sqlite-proxy", // plugin names cannot include underscore
        inline,
    );

    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
