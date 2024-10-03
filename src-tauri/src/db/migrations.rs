use std::borrow::Cow;

use anyhow::{anyhow, Result};
use futures_core::future::BoxFuture;
use sqlx::migrate::{Migration, MigrationSource, MigrationType, Migrator};
use tauri::{Manager, State};
use tauri_plugin_sql::{
    DbInstances, Migration as TauriMigration, MigrationKind as TauriMigrationKind,
};

#[derive(Debug)]
pub struct MigrationList(Vec<Migration>);

// #[derive(Debug)]
// struct Migrations();

pub fn get_all() -> MigrationList {
    let migrations = get_all_tauri();
    return MigrationList(
        migrations
            .iter()
            .map(|m| {
                Migration::new(
                    m.version,
                    Cow::Borrowed(m.description),
                    match m.kind {
                        TauriMigrationKind::Up => MigrationType::ReversibleUp,
                        TauriMigrationKind::Down => MigrationType::ReversibleDown,
                    },
                    Cow::Borrowed(m.sql),
                    false,
                )
            })
            .collect(),
    );
}

impl MigrationSource<'static> for MigrationList {
    fn resolve(self) -> BoxFuture<'static, Result<Vec<Migration>, sqlx::error::BoxDynError>> {
        Box::pin(async move { Ok(self.0) })
    }
}

pub fn get_all_tauri() -> Vec<TauriMigration> {
    return vec![
        TauriMigration {
            version: 1,
            description: "create_test_table",
            kind: TauriMigrationKind::Up,
            sql: "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);",
        },
        TauriMigration {
            version: 1,
            description: "create_test_table",
            kind: TauriMigrationKind::Down,
            sql: "DROP TABLE test",
        },
    ];
}

pub async fn revert(app: &tauri::App, db_url: &str, version: i64) -> Result<()> {
    let mutex_db_hash: State<DbInstances> = app.try_state().ok_or_else(|| {
        anyhow!("expected a database connection to exist before calling `revert`.")
    })?;
    let db_hash = mutex_db_hash.inner().0.lock().await;
    let db_pool = db_hash
        .get(db_url)
        .ok_or_else(|| anyhow!("Database not initialized: {}", db_url))?;

    let migrations = get_all();
    let migrator = Migrator::new(migrations).await?;
    migrator
        .undo(db_pool, version)
        .await
        .map_err(anyhow::Error::from)
}
