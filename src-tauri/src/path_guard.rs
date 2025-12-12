//! Path validation for export operations.
//!
//! All IPC paths are untrusted. This module canonicalizes and validates
//! paths before any file operations or subprocess spawning.

use std::path::PathBuf;

/// Validated export paths ready for use.
#[derive(Debug)]
pub struct GuardedExportPaths {
    pub audio: PathBuf,
    pub output: PathBuf,
}

/// Validate and canonicalize export paths.
///
/// # Errors
/// Returns human-readable error string on validation failure.
pub fn guard_export_paths(audio_path: &str, output_path: &str) -> Result<GuardedExportPaths, String> {
    // Parse paths
    let audio = PathBuf::from(audio_path);
    let output = PathBuf::from(output_path);

    // Audio path validation
    if !audio.is_absolute() {
        return Err("audio_path must be absolute".into());
    }

    let audio = audio
        .canonicalize()
        .map_err(|e| format!("audio_path canonicalize failed: {}", e))?;

    if !audio.is_file() {
        return Err("audio_path must be a file".into());
    }

    // Output path validation
    if !output.is_absolute() {
        return Err("output_path must be absolute".into());
    }

    // Check extension (case-insensitive)
    let ext = output
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    if ext.as_deref() != Some("mp4") {
        return Err("output_path must end with .mp4".into());
    }

    // Check filename doesn't start with dash (ffmpeg arg ambiguity)
    if let Some(name) = output.file_name().and_then(|n| n.to_str()) {
        if name.starts_with('-') {
            return Err("output filename cannot start with '-'".into());
        }
    }

    // Parent directory must exist
    let parent = output
        .parent()
        .ok_or("output_path missing parent directory")?;

    if !parent.exists() {
        return Err("output directory does not exist".into());
    }

    if !parent.is_dir() {
        return Err("output parent is not a directory".into());
    }

    Ok(GuardedExportPaths { audio, output })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    fn create_test_audio(dir: &std::path::Path) -> PathBuf {
        let path = dir.join("test.mp3");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"fake audio data").unwrap();
        path
    }

    #[test]
    fn accepts_valid_paths() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.mp4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_ok());
        let guarded = result.unwrap();
        assert!(guarded.audio.is_absolute());
        assert!(guarded.output.is_absolute());
    }

    #[test]
    fn rejects_relative_audio_path() {
        let dir = tempdir().unwrap();
        let output = dir.path().join("output.mp4");

        let result = guard_export_paths("relative/path.mp3", output.to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("audio_path must be absolute"));
    }

    #[test]
    fn rejects_nonexistent_audio() {
        let dir = tempdir().unwrap();
        let audio = dir.path().join("nonexistent.mp3");
        let output = dir.path().join("output.mp4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("canonicalize failed"));
    }

    #[test]
    fn rejects_audio_directory() {
        let dir = tempdir().unwrap();
        let subdir = dir.path().join("subdir");
        fs::create_dir(&subdir).unwrap();
        let output = dir.path().join("output.mp4");

        let result = guard_export_paths(
            subdir.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must be a file"));
    }

    #[test]
    fn rejects_relative_output_path() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());

        let result = guard_export_paths(audio.to_str().unwrap(), "output.mp4");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("output_path must be absolute"));
    }

    #[test]
    fn rejects_non_mp4_extension() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.avi");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must end with .mp4"));
    }

    #[test]
    fn accepts_uppercase_mp4_extension() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.MP4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn rejects_dash_prefixed_filename() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("-output.mp4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("cannot start with '-'"));
    }

    #[test]
    fn rejects_missing_output_parent() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("nonexistent_dir").join("output.mp4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("directory does not exist"));
    }
}
