import AppKit
import CoreGraphics
import Darwin

let url = URL(fileURLWithPath: CommandLine.arguments[1])
if CommandLine.arguments.count == 3 {
    let pid = Int(CommandLine.arguments[2])!
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]
    let window = windows.first {
        ($0[kCGWindowOwnerPID as String] as? Int) == pid && ($0[kCGWindowLayer as String] as? Int) == 0
    }!
    let capture = Process()
    capture.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    capture.arguments = ["screencapture", "-x", "-o", "-l", String(window[kCGWindowNumber as String] as! Int), url.path]
    try capture.run()
    capture.waitUntilExit()
    if capture.terminationStatus != 0 { exit(1) }
}
let image = NSBitmapImageRep(data: try Data(contentsOf: url))!
var darkest = 1.0
var lightest = 0.0

// Inspect the application's media-control region, excluding window borders,
// the macOS menu bar and the Dock. A live but flat blank window is not UI proof.
for y in (image.pixelsHigh / 10)..<(image.pixelsHigh * 3 / 5) {
    for x in (image.pixelsWide / 50)..<(image.pixelsWide * 3 / 10) {
        let color = image.colorAt(x: x, y: y)!.usingColorSpace(.deviceRGB)!
        let brightness = Double((color.redComponent + color.greenComponent + color.blueComponent) / 3)
        darkest = min(darkest, brightness)
        lightest = max(lightest, brightness)
    }
}
print("Native media-control region contrast: \(lightest - darkest)")
if lightest - darkest <= 0.25 {
    FileHandle.standardError.write(Data("Refusing a blank native application window\n".utf8))
    exit(1)
}
