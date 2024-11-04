use crate::plugins::sqlite_proxy::migrations::Migration;

pub fn get_migrations() -> Vec<Migration> {
    return [
        // drop_books_table(), // if needed to reset DB state in dev
        add_books_table(),
    ]
    .into();
}

#[allow(dead_code)]
fn drop_books_table() -> Migration {
    Migration {
        name: "drop_books_table".into(),
        description: "Drops the books table as a one time thing.".into(),
        sql: "DROP TABLE IF EXISTS books;".into(),
    }
}

fn add_books_table() -> Migration {
    Migration {
        name: "add_books_table".into(),
        description: "Adds an initial implementation of the books table".into(),
        sql: r#"CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY default(uuid_blob(uuid())) NOT NULL,
      isbn10 TEXT,
      isbn13 TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      authors TEXT NOT NULL,
      tags TEXT,
      series TEXT,
      pageCount INTEGER,
      publicationDate TEXT,
      copyrightDate TEXT,
      coverImages TEXT,
      hasRead INTEGER
    );"#
        .into(),
    }
}
