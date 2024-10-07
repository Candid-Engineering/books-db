use rusqlite::{params_from_iter, Connection, Statement};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{json, Map, Value};
use serde_rusqlite::{from_row, from_rows};
use std::{fs::create_dir_all, sync::Mutex};
use tauri::{
    plugin::{Builder, PluginApi, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("DB already initialized")]
    AlreadyInitialized,

    #[error("Error locking DbInstance")]
    FailedMutex,

    #[error("Failed to parse sql results")]
    SerdeRusqlite(#[from] serde_rusqlite::Error),

    #[error("Error: {0}")]
    Generic(&'static str),

    #[error("IO Error: {0}")]
    Startup(&'static str),

    #[error(transparent)]
    Rusqlite(#[from] rusqlite::Error),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
type Result<T> = std::result::Result<T, Error>;

#[derive(Default)]
pub struct DbInstance(pub Mutex<Option<Connection>>);

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Method {
    Get,
    All,
    Values,
    Run,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BatchQuery {
    sql: String,
    params: Vec<String>,
    method: Method,
}

/// Opens or creates a database for `filename`. Correctly passes through `:memory:` values
/// for in-memory databases. Otherwise, makes sure to append the full config path for `app`.
fn connection_for<R: Runtime>(app: &AppHandle<R>, filename: &String) -> Result<Connection> {
    let config_path = app
        .path()
        .app_config_dir()
        .map_err(|_| Error::Startup("Failed to get App path"))?;
    create_dir_all(&config_path)
        .map_err(|_| Error::Startup("Failed to initialize configuration folder."))?;
    let full_path = if filename.starts_with(":memory:") || filename.starts_with("file::memory:") {
        filename.into()
    } else {
        config_path.join(&filename)
    };
    Connection::open(&full_path).map_err(Error::Rusqlite)
}

#[tauri::command]
// this will be accessible with `invoke('plugin:sqlite-proxy|query')`.
pub fn query<R: Runtime>(
    _app: AppHandle<R>,
    state_db_instance: State<'_, DbInstance>,
    sql: String,
    params: Vec<Value>,
    method: Method, // Must be: `run`, `all`, `values`, or `get`
) -> Result<Value> {
    let conn_guard = state_db_instance.0.lock().expect("mutex error");
    let conn: &Connection = conn_guard.as_ref().expect("no connection");
    let statement = conn.prepare(&sql)?;
    match method {
        Method::Get => query_get(statement, params),
        Method::All => query_all(statement, params),
        Method::Values => query_values(statement, params),
        Method::Run => query_run(statement, params),
    }
}

#[tauri::command]
// this will be accessible with `invoke('plugin:sqlite-proxy|migrate')`.
pub fn migrate<R: Runtime>(
    _app: AppHandle<R>,
    state_db_instance: State<'_, DbInstance>,
    queries: Vec<String>,
) -> Result<serde_json::Value> {
    let mut conn_guard = state_db_instance.0.lock().expect("mutex error");
    let conn = conn_guard.as_mut().expect("no connection");
    let tx = conn.transaction()?;
    let results = queries
        .iter()
        .map(|query| tx.prepare(query)?.execute([]).map_err(Error::from))
        .collect::<Result<Vec<_>>>()?;
    tx.commit()?;

    Ok(json!({"affected_rows": results}))
}

#[tauri::command]
// this will be accessible with `invoke('plugin:sqlite-proxy|batch')`.
pub fn batch<R: Runtime>(
    _app: AppHandle<R>,
    state_db_instance: State<'_, DbInstance>,
    queries: Vec<BatchQuery>,
) -> Result<Value> {
    let mut conn_guard = state_db_instance.0.lock().expect("mutex error");
    let conn = conn_guard.as_mut().expect("no connection");
    let tx = conn.transaction()?;
    let results = queries
        .iter()
        .map(|query| {
            tx.prepare(&query.sql)?
                .execute(params_from_iter(&query.params))
                .map_err(Error::from)
        })
        .collect::<Result<Vec<_>>>()?;
    tx.commit()?;

    Ok(json!({"affected_rows": results}))
}

fn query_get(mut statement: Statement, params: Vec<Value>) -> Result<Value> {
    let row = statement.query_row(params_from_iter(params), |row| {
        Ok(from_row::<Map<String, Value>>(row))
    })??;

    Ok(json!({ "rows": row }))
}

fn query_all(mut statement: Statement, params: Vec<Value>) -> Result<Value> {
    let rows = statement.query(params_from_iter(params))?;
    let rows: std::result::Result<Vec<Map<String, Value>>, serde_rusqlite::Error> =
        from_rows::<Map<String, Value>>(rows).collect();

    Ok(json!({ "rows": rows? }))
}

fn query_values(mut statement: Statement, params: Vec<Value>) -> Result<Value> {
    let rows = statement.query(params_from_iter(params))?;
    let rows: std::result::Result<Vec<Value>, serde_rusqlite::Error> =
        from_rows::<Value>(rows).collect();

    Ok(json!({ "rows": rows? }))
}

fn query_run(mut statement: Statement, params: Vec<Value>) -> Result<Value> {
    let result = statement.execute(params_from_iter(params))?;
    Ok(json!({"rows": [], "affected_rows": result}))
}

pub fn init<R: Runtime>(filename: impl Into<String>) -> TauriPlugin<R> {
    let filename: String = filename.into().clone();
    Builder::new("sqlite-proxy")
        .setup(move |app, api| setup(app, api, &filename))
        .invoke_handler(tauri::generate_handler![query, batch, migrate])
        .build()
}

fn setup<R: Runtime>(
    app: &AppHandle<R>,
    _api: PluginApi<R, ()>,
    filename: &String,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let connection = connection_for(&app, &filename)?;
    let db_instance: DbInstance = DbInstance(Mutex::new(Some(connection)));
    app.manage(db_instance);
    Ok(())
}
