use rusqlite::types::ToSql;
use serde_json::Value;

#[derive(Clone, Debug)]
pub(super) struct JsonParam(Value);

/// A wrapper for `serde_json::Value` to facilitate usage as parameter values
/// for non-JSON fields.
///
/// This is necessary because the default `to_sql` implementation encodes JSON
/// directly, which leaves extra `"` around text values. See: https://github.com/rusqlite/rusqlite/issues/1312
impl From<Value> for JsonParam {
    fn from(value: Value) -> Self {
        JsonParam(value)
    }
}

impl ToSql for JsonParam {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        match &self.0 {
            Value::String(s) => s.as_str().to_sql(), // direct conversion instead of producing "str".
            _ => self.0.to_sql(), // original to_sql already handles other values correctly.
        }
    }
}

pub(super) fn into_json_params(params: Vec<Value>) -> Vec<JsonParam> {
    params.into_iter().map(JsonParam::from).collect()
}
