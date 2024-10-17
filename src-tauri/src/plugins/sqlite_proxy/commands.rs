use std::sync::Mutex;

use super::error::Res;
use super::lib;
use rusqlite::Connection;
use serde_json::{Map, Value};
use tauri::State;

// Note: this file is just thin wrappers, mostly for ease of unit-testing the underlying code
// without relying on `tauri::State` as a parameter.

/// Accessible with `invoke('plugin:sqlite-proxy|query')`.
#[tauri::command]
#[specta::specta]
pub fn query(
    connection_mutex: State<'_, Mutex<Connection>>,
    sql: String,
    params: Option<Vec<Value>>,
) -> Res<Vec<Map<String, Value>>> {
    let locked_connection = connection_mutex.lock()?;
    lib::query(&locked_connection, sql, params)
}

/// Accessible with `invoke('plugin:sqlite-proxy|query_row')`.
#[tauri::command]
#[specta::specta]
pub fn query_row(
    connection_mutex: State<'_, Mutex<Connection>>,
    sql: String,
    params: Option<Vec<Value>>,
) -> Res<Map<String, Value>> {
    let locked_connection = connection_mutex.lock()?;
    lib::query_row(&locked_connection, sql, params)
}

/// Accessible with `invoke('plugin:sqlite-proxy|execute')`.
#[tauri::command]
#[specta::specta]
pub fn execute(
    connection_mutex: State<'_, Mutex<Connection>>,
    sql: String,
    params: Option<Vec<Value>>,
) -> Res<i32> {
    let locked_connection = connection_mutex.lock()?;
    lib::execute(&locked_connection, sql, params)
}

#[cfg(test)]
mod test {
    use std::sync::Mutex;

    use super::super::Error;
    use super::*;
    use lib::connection_for;
    use serde_json::json;
    use tauri::{test::MockRuntime, App, Manager, State};

    fn setup_runtime() -> App<MockRuntime> {
        let app = tauri::test::mock_app();
        let app_config_folder = app
            .path()
            .app_config_dir()
            .expect("Failed to get an app folder.");
        let connection = connection_for(&app_config_folder, &":memory:".into()).unwrap();
        connection
            .execute(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
                [],
            )
            .unwrap();

        connection
            .execute(
                "INSERT INTO users (id, name) VALUES (?1, ?2)",
                ["1", "Alice"],
            )
            .unwrap();
        app.manage(Mutex::new(connection));
        app
    }

    #[test]
    fn test_query_all() -> std::result::Result<(), Error> {
        let runtime = setup_runtime();
        let manager: State<'_, Mutex<Connection>> = runtime.state();

        assert_eq!(
            vec![json!({"id": 1, "name": "Alice"})
                .as_object()
                .unwrap()
                .clone()],
            query(manager, "SELECT * from users;".into(), None,).unwrap()
        );

        Ok(())
    }
}
