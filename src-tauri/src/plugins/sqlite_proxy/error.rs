use std::sync::{MutexGuard, PoisonError};

use rusqlite::Connection;
use serde::{Serialize, Serializer};

// TODO(rkofman): derive or implement `partialEq`. Pitfall: `SerdeRusqlite` doesn't currently
// derive it (but I think it could? try opening a PR? try a workaround?)
#[derive(Debug, thiserror::Error, specta::Type)]
#[serde(tag = "error_type", content = "error_text")]
pub enum Error {
    #[error("DB already initialized")]
    AlreadyInitialized,

    #[error("Error locking DbInstance")]
    FailedMutex(String),

    #[error("Failed to parse sql results")]
    SerdeRusqlite(
        #[specta(type = String)]
        #[from]
        serde_rusqlite::Error,
    ),

    #[error("Error: {0}")]
    Generic(&'static str),

    #[error("IO Error: {0}")]
    Startup(&'static str),

    #[error(transparent)]
    Rusqlite(
        #[serde(serialize_with = "stringify_error")]
        #[specta(type = String)]
        #[from]
        rusqlite::Error,
    ),
}
impl From<PoisonError<MutexGuard<'_, Connection>>> for Error {
    fn from(err: PoisonError<MutexGuard<Connection>>) -> Self {
        Error::FailedMutex(err.to_string())
    }
}

#[allow(dead_code)] // used in `serde(serialize_with = ...)`, above.
fn stringify_error<S>(err: serde_rusqlite::Error, s: S) -> std::result::Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let foo = format!("Error: {:?}", err);
    log::debug!("foo: {:?}", &foo.as_str());
    s.serialize_str(foo.as_str())
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Res<T> = std::result::Result<T, Error>;
