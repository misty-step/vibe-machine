import AppKit
import CoreGraphics
import Darwin
import Vision

if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "quit" {
    let pid = Int32(CommandLine.arguments[2])!
    guard let application = NSRunningApplication(processIdentifier: pid), application.terminate() else {
        FileHandle.standardError.write(Data("Could not request graceful native exit\n".utf8))
        exit(1)
    }
    exit(0)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
if CommandLine.arguments.count >= 3 {
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

// Test-only OCR and native input for the installed-bundle settings recovery walk.
// No application debug endpoint or user profile is involved.
if CommandLine.arguments.count == 5 {
    let action = CommandLine.arguments[3]
    let expected = CommandLine.arguments[4].lowercased()
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    try VNImageRequestHandler(url: url).perform([request])
    let observations = request.results ?? []
    if action == "contains" {
        let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ").lowercased()
        guard text.contains(expected) else {
            FileHandle.standardError.write(Data("Expected native recovery text was not visible\n".utf8))
            exit(1)
        }
    } else if action == "click" {
        guard CGPreflightPostEventAccess() else {
            FileHandle.standardError.write(Data("Native click permission is unavailable; retry is unverified\n".utf8))
            exit(1)
        }
        let labels = observations.compactMap { $0.topCandidates(1).first }
        let label = labels.first { $0.string.lowercased() == expected }
            ?? labels.first { $0.string.lowercased().contains(expected) }
        guard let label = label,
              let range = label.string.range(of: expected, options: .caseInsensitive),
              let box = try label.boundingBox(for: range) else {
            FileHandle.standardError.write(Data("Native recovery control was not visible\n".utf8))
            exit(1)
        }
        let pid = Int(CommandLine.arguments[2])!
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]
        let window = windows.first {
            ($0[kCGWindowOwnerPID as String] as? Int) == pid && ($0[kCGWindowLayer as String] as? Int) == 0
        }!
        let bounds = CGRect(dictionaryRepresentation: window[kCGWindowBounds as String] as! CFDictionary)!
        let point = CGPoint(x: bounds.minX + box.boundingBox.midX * bounds.width,
                            y: bounds.minY + (1 - box.boundingBox.midY) * bounds.height)
        for type in [CGEventType.leftMouseDown, CGEventType.leftMouseUp] {
            CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)!.post(tap: .cghidEventTap)
        }
    } else {
        exit(1)
    }
}
