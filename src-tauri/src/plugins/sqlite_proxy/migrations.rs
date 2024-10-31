use rusqlite::Connection;

use super::Res;

#[derive(Clone)]
pub struct Migration {
    pub name: String,
    pub description: String,
    pub sql: String,
}

pub fn apply_migrations(connection: &Connection, migrations: &[Migration]) -> Res<()> {
    for migration in migrations {
        connection.execute(&migration.sql, [])?;
    }

    Ok(())
}
