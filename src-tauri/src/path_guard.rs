//! Path validation for export operations.
//!
//! All IPC paths are untrusted. This module canonicalizes and validates
//! paths before any file operations or subprocess spawning.

use std::path::PathBuf;

/// Validated export paths ready for use (single audio).
/// Used by tests and kept for backwards compatibility.
#[derive(Debug)]
#[allow(dead_code)]
pub struct GuardedExportPaths {
    pub audio: PathBuf,
    pub output: PathBuf,
    pub image: Option<PathBuf>,
}

/// Validated export paths for multi-track export.
#[derive(Debug)]
pub struct GuardedMultiTrackPaths {
    pub audio_paths: Vec<PathBuf>,
    pub output: PathBuf,
    pub image: Option<PathBuf>,
}

/// Validate a single audio path.
fn validate_audio_path(path: &str) -> Result<PathBuf, String> {
    let audio = PathBuf::from(path);
    if !audio.is_absolute() {
        return Err(format!("audio path must be absolute: {}", path));
    }
    let audio = audio
        .canonicalize()
        .map_err(|e| format!("audio path canonicalize failed for '{}': {}", path, e))?;
    if !audio.is_file() {
        return Err(format!("audio path must be a file: {}", path));
    }
    Ok(audio)
}

/// Validate and canonicalize export paths for multi-track export.
///
/// # Errors
/// Returns human-readable error string on validation failure.
pub fn guard_multi_track_paths(
    audio_paths: &[String],
    output_path: &str,
    image_path: &str,
) -> Result<GuardedMultiTrackPaths, String> {
    if audio_paths.is_empty() {
        return Err("at least one audio path required".into());
    }

    // Validate all audio paths
    let validated_audio: Vec<PathBuf> = audio_paths
        .iter()
        .map(|p| validate_audio_path(p))
        .collect::<Result<Vec<_>, _>>()?;

    // Validate output and image (reuse existing logic)
    let (output, image) = validate_output_and_image(output_path, image_path)?;

    Ok(GuardedMultiTrackPaths {
        audio_paths: validated_audio,
        output,
        image,
    })
}

/// Validate output path and optional image path.
fn validate_output_and_image(
    output_path: &str,
    image_path: &str,
) -> Result<(PathBuf, Option<PathBuf>), String> {
    let output = PathBuf::from(output_path);

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

    // Image path validation (optional)
    let image = if image_path.is_empty() {
        None
    } else {
        let img = PathBuf::from(image_path);
        if !img.is_absolute() {
            return Err("image_path must be absolute".into());
        }
        let img = img
            .canonicalize()
            .map_err(|e| format!("image_path canonicalize failed: {}", e))?;
        if !img.is_file() {
            return Err("image_path must be a file".into());
        }
        Some(img)
    };

    Ok((output, image))
}

/// Validate and canonicalize export paths (single audio).
/// Used by tests and kept for backwards compatibility.
///
/// # Errors
/// Returns human-readable error string on validation failure.
#[allow(dead_code)]
pub fn guard_export_paths(
    audio_path: &str,
    output_path: &str,
    image_path: &str,
) -> Result<GuardedExportPaths, String> {
    let audio = validate_audio_path(audio_path)?;
    let (output, image) = validate_output_and_image(output_path, image_path)?;

    Ok(GuardedExportPaths { audio, output, image })
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
            "",
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

        let result = guard_export_paths("relative/path.mp3", output.to_str().unwrap(), "");
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
            "",
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
            "",
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must be a file"));
    }

    #[test]
    fn rejects_relative_output_path() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());

        let result = guard_export_paths(audio.to_str().unwrap(), "output.mp4", "");
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
            "",
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
            "",
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
            "",
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
            "",
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("directory does not exist"));
    }

    fn create_test_image(dir: &std::path::Path) -> PathBuf {
        let path = dir.join("test.png");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"fake png data").unwrap();
        path
    }

    #[test]
    fn accepts_valid_image_path() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.mp4");
        let image = create_test_image(dir.path());

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
            image.to_str().unwrap(),
        );

        assert!(result.is_ok());
        let guarded = result.unwrap();
        assert!(guarded.image.is_some());
        assert!(guarded.image.unwrap().is_absolute());
    }

    #[test]
    fn accepts_empty_image_path() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.mp4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
            "",
        );

        assert!(result.is_ok());
        assert!(result.unwrap().image.is_none());
    }

    #[test]
    fn rejects_relative_image_path() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.mp4");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
            "relative/image.png",
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("image_path must be absolute"));
    }

    #[test]
    fn rejects_nonexistent_image() {
        let dir = tempdir().unwrap();
        let audio = create_test_audio(dir.path());
        let output = dir.path().join("output.mp4");
        let image = dir.path().join("nonexistent.png");

        let result = guard_export_paths(
            audio.to_str().unwrap(),
            output.to_str().unwrap(),
            image.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("image_path canonicalize failed"));
    }
}
