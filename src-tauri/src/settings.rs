//! Admit only successfully read preferences to the plugin's save-on-exit store.

use std::{collections::HashMap, fs, io::ErrorKind, path::Path};
use tauri::Runtime;
use tauri_plugin_store::{resolve_store_path, JsonValue, StoreExt};

const READ_ERROR: &str = "Preferences could not be loaded. The saved file was not changed.";

fn read_saved_map(path: &Path) -> Result<HashMap<String, JsonValue>, &'static str> {
    // A dangling link or an unreadable existing file is not a fresh installation.
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(_) => return Err(READ_ERROR),
        Ok(_) => {}
    }
    let bytes = fs::read(path).map_err(|_| READ_ERROR)?;
    let values: HashMap<String, JsonValue> =
        serde_json::from_slice(&bytes).map_err(|_| READ_ERROR)?;
    if values
        .get("settings")
        .is_some_and(|settings| !settings.is_null() && !settings.is_object())
    {
        return Err(READ_ERROR);
    }
    Ok(values)
}

fn load_settings_at<R: Runtime>(
    app: &tauri::AppHandle<R>,
    path: &Path,
) -> Result<Option<JsonValue>, &'static str> {
    if let Some(store) = app.get_store(path) {
        return Ok(store.get("settings"));
    }
    let resolved = resolve_store_path(app, path).map_err(|_| READ_ERROR)?;
    let values = read_saved_map(&resolved)?;
    // StoreBuilder's default load discards read errors. Supply the verified full
    // map instead, with no second read and no automatic, unobserved write timer.
    let store = app
        .store_builder(path)
        .defaults(values)
        .create_new()
        .disable_auto_save()
        .build()
        .map_err(|_| READ_ERROR)?;
    Ok(store.get("settings"))
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<Option<JsonValue>, &'static str> {
    load_settings_at(&app, Path::new("settings.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn app() -> tauri::App<tauri::test::MockRuntime> {
        tauri::test::mock_builder()
            .plugin(tauri_plugin_store::Builder::default().build())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap()
    }

    #[test]
    fn corrupt_file_is_not_registered_for_save_on_exit_and_can_be_retried() {
        let app = app();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let original = b"{\"settings\": private-broken-fixture";
        fs::write(&path, original).unwrap();
        assert_eq!(load_settings_at(app.handle(), &path), Err(READ_ERROR));
        assert!(app.get_store(&path).is_none());
        assert_eq!(fs::read(&path).unwrap(), original);

        fs::write(&path, br##"{"settings":{"visualizerColor":"#123456"},"unknown":{"keep":true}}"##).unwrap();
        assert_eq!(
            load_settings_at(app.handle(), &path).unwrap(),
            Some(json!({"visualizerColor": "#123456"}))
        );
        let store = app.get_store(&path).unwrap();
        store.set("settings", json!({"visualizerColor": "#654321"}));
        store.save().unwrap();
        let saved: JsonValue = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(saved["unknown"], json!({"keep": true}));
        assert_eq!(saved["settings"]["visualizerColor"], "#654321");
    }

    #[test]
    fn missing_file_is_new_but_existing_unreadable_path_is_rejected() {
        let app = app();
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("new.json");
        assert_eq!(load_settings_at(app.handle(), &missing), Ok(None));
        assert!(!missing.exists());
        assert!(app.get_store(&missing).is_some());

        let unreadable = dir.path().join("directory.json");
        fs::create_dir(&unreadable).unwrap();
        assert_eq!(load_settings_at(app.handle(), &unreadable), Err(READ_ERROR));
        assert!(app.get_store(&unreadable).is_none());
        assert!(unreadable.is_dir());
    }

    #[test]
    fn invalid_settings_shape_is_not_a_successful_empty_read() {
        let app = app();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        for original in ["[]", "null", r#"{"settings":[]}"#, r#"{"settings":42}"#] {
            fs::write(&path, original).unwrap();
            assert_eq!(load_settings_at(app.handle(), &path), Err(READ_ERROR));
            assert!(app.get_store(&path).is_none());
            assert_eq!(fs::read_to_string(&path).unwrap(), original);
        }
    }

    #[cfg(unix)]
    #[test]
    fn dangling_link_is_not_a_missing_file() {
        let app = app();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let target = dir.path().join("missing.json");
        std::os::unix::fs::symlink(&target, &path).unwrap();
        assert_eq!(load_settings_at(app.handle(), &path), Err(READ_ERROR));
        assert!(app.get_store(&path).is_none());
        assert!(!target.exists());
        assert_eq!(fs::read_link(path).unwrap(), target);
    }

    #[test]
    fn repeated_load_keeps_the_existing_native_store() {
        let app = app();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        load_settings_at(app.handle(), &path).unwrap();
        let store = app.get_store(&path).unwrap();
        store.set("settings", json!({"showTitle": false}));
        assert_eq!(
            load_settings_at(app.handle(), &path).unwrap(),
            Some(json!({"showTitle": false}))
        );
        assert!(std::sync::Arc::ptr_eq(&store, &app.get_store(&path).unwrap()));
    }
}
