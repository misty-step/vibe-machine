use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// --- Types ---

#[wasm_bindgen]
#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum VisualizerMode {
    Bars,
    Orbital,
    Wave,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VibeSettings {
    pub visualizer_mode: VisualizerMode,
    pub visualizer_color: String,
    pub visualizer_intensity: f32,
}

// --- Micro-Rasterizer (Pure Rust) ---

#[wasm_bindgen]
pub struct VibeEngine {
    width: i32,
    height: i32,
    pixels: Vec<u32>, // ARGB buffer
    physics_state: Vec<f32>,
}

#[wasm_bindgen]
impl VibeEngine {
    pub fn new(width: i32, height: i32) -> VibeEngine {
        let size = (width * height) as usize;
        let pixels = vec![0xFF000000; size]; // Init with opaque black (Alpha first for Little Endian?)
        // Actually Canvas ImageData expects RGBA or BGRA depending on architecture, 
        // but usually we write 32-bit integers. 
        // 0xFF000000 is Alpha=255, R=0, G=0, B=0 (Big Endian assumption).
        // In Little Endian (WASM usually), 0xFF000000 is A=255 at byte 3.
        
        let physics_state = vec![0.0; 64];
        VibeEngine {
            width,
            height,
            pixels,
            physics_state,
        }
    }

    pub fn resize(&mut self, width: i32, height: i32) {
        self.width = width;
        self.height = height;
        self.pixels.resize((width * height) as usize, 0xFF000000);
    }

    pub fn get_pixel_ptr(&self) -> *const u32 {
        self.pixels.as_ptr()
    }

    pub fn render(&mut self, settings_val: JsValue, freq_data: &[u8], _time: f64) -> Result<(), JsValue> {
        let settings: VibeSettings = serde_wasm_bindgen::from_value(settings_val)?;
        
        // 1. Clear (Fast memset)
        // 0x00000000 -> Transparent
        self.pixels.fill(0x00000000); 

        // 2. Physics
        self.update_physics(freq_data);

        // 3. Draw
        match settings.visualizer_mode {
            VisualizerMode::Bars => self.draw_bars(&settings),
            _ => (), // TODO
        }

        Ok(())
    }

    fn update_physics(&mut self, freq_data: &[u8]) {
        let attack = 0.6;
        let decay = 0.12;
        let bar_count = 32;

        for i in 0..bar_count {
            let freq_index = (1.18f32.powf((i + 5) as f32)).floor() as usize;
            let mut target = 0.0;

            if freq_index < freq_data.len() {
                let v1 = freq_data[freq_index] as f32;
                let v2 = if freq_index + 1 < freq_data.len() { freq_data[freq_index + 1] as f32 } else { 0.0 };
                target = ((v1 + v2) / 2.0) / 255.0;
            }
            
            target *= 1.3;

            let current = self.physics_state[i];
            let alpha = if target > current { attack } else { decay };
            self.physics_state[i] = current + (target - current) * alpha;
        }
    }

    fn draw_bars(&mut self, settings: &VibeSettings) {
        let padding = 80;
        let viz_width = 600;
        let origin_x = self.width - padding - viz_width;
        let origin_y = self.height - padding;
        
        let visible_bars: i32 = 12; 
        let bar_w: i32 = 24; 
        let gap: i32 = 12; 
        let max_h = 200.0 * settings.visualizer_intensity;

        let color = self.hex_to_u32(&settings.visualizer_color);

        for i in 0..visible_bars {
            let idx = (i * 2) as usize;
            let val = self.physics_state[idx];
            let h = (val.powf(1.4) * max_h).max(4.0) as i32;

            let x = (origin_x + viz_width) - ((visible_bars - i) * (bar_w + gap));
            let y = origin_y - h;

            self.fill_rect(x, y, bar_w, h, color);
        }
    }

    // --- Rasterizer Helpers ---

    fn hex_to_u32(&self, hex: &str) -> u32 {
        // Expects #RRGGBB
        if hex.len() == 7 {
            let r = u8::from_str_radix(&hex[1..3], 16).unwrap_or(255);
            let g = u8::from_str_radix(&hex[3..5], 16).unwrap_or(255);
            let b = u8::from_str_radix(&hex[5..7], 16).unwrap_or(255);
            // ABGR Little Endian
            return (255 << 24) | ((b as u32) << 16) | ((g as u32) << 8) | (r as u32);
        }
        0xFF03B7FF // Default Plasma (ABGR)
    }

    fn fill_rect(&mut self, x: i32, y: i32, w: i32, h: i32, color: u32) {
        // Clipping
        let x0 = x.max(0);
        let y0 = y.max(0);
        let x1 = (x + w).min(self.width);
        let y1 = (y + h).min(self.height);

        if x0 >= x1 || y0 >= y1 { return; }

        for cy in y0..y1 {
            let start = (cy * self.width + x0) as usize;
            let end = (cy * self.width + x1) as usize;
            self.pixels[start..end].fill(color);
        }
    }
}
