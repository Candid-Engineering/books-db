use std::{fs::create_dir_all, path::PathBuf};

use super::error::{Error, Res};
use super::json_param::into_json_params;
use rusqlite::{params_from_iter, Connection};
use serde_json::{Map, Value};
use serde_rusqlite::{from_row, from_rows};

/// Opens or creates a database for `filename`. Correctly passes through `:memory:` values
/// for in-memory databases. Otherwise, makes sure to append the full config path for `app`.
pub(super) fn connection_for(config_path: &PathBuf, filename: &String) -> Res<Connection> {
    create_dir_all(&config_path)
        .map_err(|_| Error::Startup("Failed to initialize configuration folder."))?;
    let full_path = if filename.starts_with(":memory:") || filename.starts_with("file::memory:") {
        filename.into()
    } else {
        config_path.join(&filename)
    };
    Connection::open(&full_path).map_err(Error::Rusqlite)
}

pub(super) fn query(
    connection: &Connection,
    sql: String,
    params: Option<Vec<Value>>,
) -> Res<Vec<Map<String, Value>>> {
    let params: Vec<_> = into_json_params(params.unwrap_or_default());
    let params = params_from_iter(params);
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query(params)?;
    let rows: std::result::Result<Vec<Map<String, Value>>, serde_rusqlite::Error> =
        from_rows::<Map<String, Value>>(rows).collect();
    Ok(rows?)
}

pub(super) fn query_row(
    connection: &Connection,
    sql: String,
    params: Option<Vec<Value>>,
) -> Res<Map<String, Value>> {
    let params: Vec<_> = into_json_params(params.unwrap_or_default());
    let params = params_from_iter(params);
    let mut statement = connection.prepare(&sql)?;
    let row = statement.query_row(params, |row| Ok(from_row::<Map<String, Value>>(row)))?;
    Ok(row?)
}

pub(super) fn execute(
    connection: &Connection,
    sql: String,
    params: Option<Vec<Value>>,
) -> Res<i32> {
    let params: Vec<_> = into_json_params(params.unwrap_or_default());
    let params = params_from_iter(params);

    let mut statement = connection.prepare(&sql)?;
    let count = statement.execute(params)?;
    // if too many rows are affected, we return the largest number we can represent in json:
    Ok(count.try_into().unwrap_or(i32::MAX))
}

#[cfg(test)]
mod test {
    use std::vec;

    use super::super::Error;
    use super::*;
    use serde_json::{json, to_string};

    struct Book<'a> {
        id: i32,
        title: &'static str,
        authors: &'a [&'a str],
    }

    fn new_books_db() -> Connection {
        let connection = connection_for(&PathBuf::new(), &":memory:".into()).unwrap();
        connection
            .execute(
                "CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, authors TEXT)",
                [],
            )
            .unwrap();
        connection
    }

    fn new_db_with(books: &[Book]) -> Connection {
        let conn = new_books_db();
        for book in books {
            let authors_json = to_string(&book.authors).unwrap();
            conn.execute(
                "INSERT INTO books VALUES (?, ?, ?)",
                (book.id, book.title, authors_json),
            )
            .unwrap();
        }
        conn
    }
    #[test]
    fn test_empty_queries() -> Result<(), Error> {
        let connection = new_books_db();

        // `#query` -> `[]` when not matching any rows
        assert_eq!(
            Vec::<Map<String, Value>>::new(),
            query(
                &connection,
                "SELECT * FROM books LIMIT 10".to_string(),
                None,
            )
            .unwrap()
        );

        // #`query_row` -> `Error: ...` when not matching any rows
        assert_eq!(
            // TODO(rkofman): remove the `to_string()` hack once our `Error` implements `PartialEq`
            Error::Rusqlite(rusqlite::Error::QueryReturnedNoRows).to_string(),
            query_row(
                &connection,
                "SELECT * FROM books WHERE id = 123".to_string(),
                None,
            )
            .unwrap_err()
            .to_string()
        );

        // #`execute` -> `0` when not affecting any rows
        assert_eq!(
            0,
            execute(
                &connection,
                "UPDATE books SET title = \"Ender's Game\" WHERE id = 123".to_string(),
                None,
            )
            .unwrap()
        );

        Ok(())
    }

    #[test]
    fn test_query_results() -> Result<(), Error> {
        let connection = new_db_with(&[
            Book {
                id: 1,
                title: "The Last Hot Time",
                authors: &vec!["John M. Ford"],
            },
            Book {
                id: 2,
                title: "The Princess and the Grilled Cheese Sandwich",
                authors: &vec!["Deya Muniz"],
            },
        ]);

        // `#query` -> `[{column_name: value, ..}, {..}]`
        let result = query(
            &connection,
            "SELECT title, id, authors FROM books LIMIT 10".to_string(),
            None,
        )
        .unwrap();
        assert_eq!(
          vec![
            json!({"id": 1, "title": "The Last Hot Time", "authors": "[\"John M. Ford\"]"}).as_object().unwrap().clone(),
            json!({"id": 2, "title": "The Princess and the Grilled Cheese Sandwich", "authors": "[\"Deya Muniz\"]"}).as_object().unwrap().clone(),
          ],
          result
        );
        // Keys must respect query order
        assert_eq!(result[0].keys().map(|k| k.as_str()).collect::<Vec<_>>(), vec!["title", "id", "authors"]);
        assert_eq!(result[1].keys().map(|k| k.as_str()).collect::<Vec<_>>(), vec!["title", "id", "authors"]);

        // #`query_row` -> {column_name: value}
        let result = query_row(
                &connection,
                "SELECT * FROM books WHERE id = 2".to_string(),
                None,
            )
            .unwrap();
        assert_eq!(
            json!({"id": 2, "title": "The Princess and the Grilled Cheese Sandwich", "authors": "[\"Deya Muniz\"]"}).as_object().unwrap().clone(),
            result
        );

        // keys maintain order of table definition by default
        assert_eq!(result.keys().map(|k| k.as_str()).collect::<Vec<_>>(), vec!["id", "title", "authors"]);
        Ok(())
    }

    #[test]
    fn test_execute() -> Result<(), Error> {
        let connection = new_books_db();
        assert_eq!(
            1,
            execute(
                &connection,
                "INSERT INTO books VALUES (1, 'The Hobbit', '[\"J. R. R. Tolkien\"]')".to_string(),
                None,
            )
            .unwrap()
        );
        assert_eq!(1, execute(&connection, "INSERT INTO books VALUES (2, 'The Fellowship of the Ring', '[\"J. R. R. Tolkien\"]')".to_string(), None).unwrap());
        // TODO(rkofman): use json extension for the authors query and update; to avoid string-matching on an array?
        assert_eq!(2, execute(&connection, "UPDATE books SET authors = '[\"John Ronald Reuel Tolkien\"]' WHERE authors = '[\"J. R. R. Tolkien\"]'".to_string(), None).unwrap());
        Ok(())
    }

    #[test]
    fn test_params() -> Result<(), Error> {
        let connection = new_books_db();
        // execute with param
        assert_eq!(
            1,
            execute(
                &connection,
                "INSERT INTO books VALUES (?, ?, ?)".to_string(),
                Some(vec!(
                    json!(1),
                    json!("The Hobbit"),
                    json!(["J. R. R. Tolkien"])
                )),
            )
            .unwrap()
        );

        let expected: Vec<Map<String, Value>> = vec![
            json!({"id": 1, "title": "The Hobbit", "authors": "[\"J. R. R. Tolkien\"]"})
                .as_object()
                .unwrap()
                .clone(),
        ];

        // query with param
        assert_eq!(
            expected,
            query(
                &connection,
                "SELECT * FROM books WHERE \"title\" = ?".to_string(),
                Some(vec!(json!("The Hobbit"))),
            )
            .unwrap()
        );

        // query_row with param
        assert_eq!(
            json!({"id": 1, "title": "The Hobbit", "authors": "[\"J. R. R. Tolkien\"]"})
                .as_object()
                .unwrap()
                .clone(),
            query_row(
                &connection,
                "SELECT * FROM books WHERE \"title\" = ?".to_string(),
                Some(vec!(json!("The Hobbit"))),
            )
            .unwrap()
        );
        Ok(())
    }
}
