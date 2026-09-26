import AVFoundation
import SwiftUI

/// The picture of a player, with no controls of its own: the transport is the
/// app's, so no built-in control can take a key the transport binds.
struct VideoSurface: NSViewRepresentable {
    let player: AVPlayer

    func makeNSView(context _: Context) -> PlayerLayerView {
        let view = PlayerLayerView()
        view.playerLayer.player = player
        return view
    }

    func updateNSView(_ view: PlayerLayerView, context _: Context) {
        if view.playerLayer.player !== player { view.playerLayer.player = player }
    }
}

/// A view backed by an `AVPlayerLayer`, letterboxed on black.
final class PlayerLayerView: NSView {
    let playerLayer = AVPlayerLayer()

    override init(frame: NSRect) {
        super.init(frame: frame)
        playerLayer.videoGravity = .resizeAspect
        playerLayer.backgroundColor = NSColor.black.cgColor
        layer = playerLayer
        wantsLayer = true
    }

    /// Clicks go through to SwiftUI, which toggles playback on a click.
    override func hitTest(_: NSPoint) -> NSView? {
        nil
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("PlayerLayerView is not built from a nib")
    }
}
