use base64::Engine;
use image::imageops::FilterType;
use image::{GenericImageView, RgbaImage};

struct Rect {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

pub struct OverlayConfig {
    pub show_progress: bool,
    pub accent_rgb: (u8, u8, u8),
}

pub struct FrameComposer {
    width: usize,
    height: usize,
    background: Vec<u8>, // RGBA
    overlay: OverlayConfig,
    text_overlay: Option<OverlayImage>,
}

impl FrameComposer {
    pub fn new(
        width: i32,
        height: i32,
        image_path: &str,
        overlay: OverlayConfig,
        text_overlay_base64: &str,
    ) -> Result<Self, String> {
        let width = width.max(1) as usize;
        let height = height.max(1) as usize;

        // Validate dimensions once; eliminates overflow everywhere else
        let _ = checked_frame_size(width, height)?;

        let background = load_background(width, height, image_path)?;
        let text_overlay = if text_overlay_base64.is_empty() {
            None
        } else {
            Some(load_text_overlay(width, height, text_overlay_base64)?)
        };
        Ok(Self {
            width,
            height,
            background,
            overlay,
            text_overlay,
        })
    }

    /// Returns the exact buffer size required for `compose_into`.
    /// Caller allocates once; no size ambiguity.
    pub fn frame_size(&self) -> usize {
        self.width * self.height * 4
    }

    /// Compose a frame. Panics if buffer sizes mismatch (indicates caller bug).
    pub fn compose_into(
        &self,
        engine_pixels: &[u8],
        frame_index: usize,
        total_frames: usize,
        out: &mut [u8],
    ) {
        let expected = self.frame_size();
        assert_eq!(
            engine_pixels.len(),
            expected,
            "engine buffer size mismatch: got {}, expected {}",
            engine_pixels.len(),
            expected
        );
        assert_eq!(
            out.len(),
            expected,
            "output buffer size mismatch: got {}, expected {}",
            out.len(),
            expected
        );

        out.copy_from_slice(&self.background);
        overlay_rgba(engine_pixels, out);
        if let Some(text) = &self.text_overlay {
            overlay_rgba(&text.pixels, out);
        }
        draw_progress(
            out,
            self.width,
            self.height,
            frame_index,
            total_frames,
            &self.overlay,
        );
    }
}

/// Validates frame dimensions and returns byte size. Fails early on overflow.
fn checked_frame_size(width: usize, height: usize) -> Result<usize, String> {
    width
        .checked_mul(height)
        .and_then(|n| n.checked_mul(4))
        .ok_or_else(|| format!("frame dimensions too large: {}x{}", width, height))
}

struct OverlayImage {
    pixels: Vec<u8>,
}

fn load_text_overlay(width: usize, height: usize, base64_png: &str) -> Result<OverlayImage, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_png.as_bytes())
        .map_err(|e| format!("overlay base64 decode failed: {}", e))?;
    let image = image::load_from_memory(&bytes)
        .map_err(|e| format!("overlay image decode failed: {}", e))?
        .to_rgba8();
    let overlay = if image.width() as usize == width && image.height() as usize == height {
        image
    } else {
        image::imageops::resize(&image, width as u32, height as u32, FilterType::Triangle)
    };
    Ok(OverlayImage {
        pixels: overlay.into_vec(),
    })
}

fn load_background(width: usize, height: usize, image_path: &str) -> Result<Vec<u8>, String> {
    // Dimensions already validated by caller; use checked_frame_size for consistency
    let size = checked_frame_size(width, height)?;

    if image_path.is_empty() {
        let mut buffer = vec![0u8; size];
        fill_solid(&mut buffer, width, height, (3, 3, 4));
        return Ok(buffer);
    }

    let image = image::open(image_path).map_err(|e| format!("image load failed: {}", e))?;
    let (iw, ih) = image.dimensions();
    if iw == 0 || ih == 0 {
        let mut buffer = vec![0u8; size];
        fill_solid(&mut buffer, width, height, (3, 3, 4));
        return Ok(buffer);
    }

    let scale = (width as f32 / iw as f32).max(height as f32 / ih as f32);
    let new_w = (iw as f32 * scale).ceil() as u32;
    let new_h = (ih as f32 * scale).ceil() as u32;
    let resized = image.resize_exact(new_w, new_h, FilterType::Lanczos3);
    let x = (new_w.saturating_sub(width as u32)) / 2;
    let y = (new_h.saturating_sub(height as u32)) / 2;
    let cropped: RgbaImage =
        image::imageops::crop_imm(&resized, x, y, width as u32, height as u32).to_image();

    Ok(cropped.into_raw())
}

fn fill_solid(buffer: &mut [u8], width: usize, height: usize, rgb: (u8, u8, u8)) {
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            buffer[idx] = rgb.0;
            buffer[idx + 1] = rgb.1;
            buffer[idx + 2] = rgb.2;
            buffer[idx + 3] = 255;
        }
    }
}

fn overlay_rgba(overlay: &[u8], out: &mut [u8]) {
    for i in (0..overlay.len()).step_by(4) {
        let alpha = overlay[i + 3];
        if alpha == 0 {
            continue;
        }
        if alpha == 255 {
            out[i..i + 4].copy_from_slice(&overlay[i..i + 4]);
            continue;
        }
        let inv = 255 - alpha;
        for c in 0..3 {
            let src = overlay[i + c] as u16;
            let dst = out[i + c] as u16;
            out[i + c] = ((src * alpha as u16 + dst * inv as u16) / 255) as u8;
        }
        out[i + 3] = 255;
    }
}

fn draw_progress(
    buffer: &mut [u8],
    width: usize,
    height: usize,
    frame_index: usize,
    total_frames: usize,
    overlay: &OverlayConfig,
) {
    if !overlay.show_progress || total_frames == 0 {
        return;
    }
    let ui_scale = (height as f32 / 1080.0).max(0.5);
    let padding = (32.0 * ui_scale).round() as i32;
    let bar_h = (8.0 * ui_scale).round().max(2.0) as i32;
    let bar_w = width as i32 - padding * 2;
    let y = height as i32 - padding - bar_h;

    let bg_rect = Rect { x: padding, y, w: bar_w, h: bar_h };
    draw_rect(buffer, width, height, &bg_rect, (255, 255, 255), 30);

    let pct = (frame_index as f32 / total_frames as f32).clamp(0.0, 1.0);
    let fill_w = (bar_w as f32 * pct).round() as i32;
    let fill_rect = Rect { x: padding, y, w: fill_w, h: bar_h };
    draw_rect(buffer, width, height, &fill_rect, overlay.accent_rgb, 255);
}

fn draw_rect(buffer: &mut [u8], width: usize, height: usize, r: &Rect, rgb: (u8, u8, u8), alpha: u8) {
    if r.w <= 0 || r.h <= 0 {
        return;
    }
    let x0 = r.x.max(0) as usize;
    let y0 = r.y.max(0) as usize;
    let x1 = (r.x + r.w).min(width as i32).max(0) as usize;
    let y1 = (r.y + r.h).min(height as i32).max(0) as usize;
    if x0 >= x1 || y0 >= y1 {
        return;
    }

    for cy in y0..y1 {
        for cx in x0..x1 {
            let idx = (cy * width + cx) * 4;
            blend_pixel(&mut buffer[idx..idx + 4], rgb, alpha);
        }
    }
}

fn blend_pixel(pixel: &mut [u8], rgb: (u8, u8, u8), alpha: u8) {
    if alpha == 255 {
        pixel[0] = rgb.0;
        pixel[1] = rgb.1;
        pixel[2] = rgb.2;
        pixel[3] = 255;
        return;
    }
    let inv = 255 - alpha;
    let r = (rgb.0 as u16 * alpha as u16 + pixel[0] as u16 * inv as u16) / 255;
    let g = (rgb.1 as u16 * alpha as u16 + pixel[1] as u16 * inv as u16) / 255;
    let b = (rgb.2 as u16 * alpha as u16 + pixel[2] as u16 * inv as u16) / 255;
    pixel[0] = r as u8;
    pixel[1] = g as u8;
    pixel[2] = b as u8;
    pixel[3] = 255;
}
