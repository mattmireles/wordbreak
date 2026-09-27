import AVFoundation
import Foundation

@MainActor
final class CheckInVoiceRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var recordingURL: URL?
    @Published private(set) var errorMessage: String?

    private var recorder: AVAudioRecorder?

    func toggle() {
        if isRecording {
            stop()
            return
        }
        AVAudioApplication.requestRecordPermission { [weak self] allowed in
            Task { @MainActor in
                guard let self else { return }
                if allowed { self.start() }
                else { self.errorMessage = "Microphone access is off. You can still finish without a voice note." }
            }
        }
    }

    func stop() {
        recorder?.stop()
        recorder = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func start() {
        do {
            guard let root = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: DailyCoordinationStore.appGroup
            ) else { throw WordbreakEngineError.stateStoreUnavailable }
            let directory = root.appending(path: "check-ins", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let url = directory.appending(path: "\(UUID().uuidString.lowercased()).m4a")
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .spokenAudio)
            try session.setActive(true)
            let recorder = try AVAudioRecorder(url: url, settings: [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ])
            recorder.delegate = self
            guard recorder.record() else { throw CocoaError(.fileWriteUnknown) }
            self.recorder = recorder
            recordingURL = url
            isRecording = true
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in
            isRecording = false
            if !flag { errorMessage = "The voice note didn’t finish recording." }
        }
    }
}
