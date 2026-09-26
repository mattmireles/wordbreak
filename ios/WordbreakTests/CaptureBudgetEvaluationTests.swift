import XCTest
#if CAPTURE_LAB_TESTS
    @testable import WordbreakCaptureLab
#else
    @testable import Wordbreak
#endif

final class CaptureBudgetEvaluationTests: XCTestCase {
    func testCompleteStableTracksPassEveryBudget() {
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 27_000, mediaDuration: 899, hostDuration: 899, dropped: 100),
            frontCamera: track(samples: 27_000, mediaDuration: 898.5, hostDuration: 898.6, dropped: 90),
            microphone: track(samples: 42_000, mediaDuration: 899.2, hostDuration: 899.1),
            appAudio: track(samples: 42_000, mediaDuration: 899.1, hostDuration: 899),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertTrue(result.passes)
        XCTAssertGreaterThanOrEqual(result.coverage["frontCamera"] ?? 0, 0.98)
        XCTAssertLessThanOrEqual(result.droppedFrameRatio["screen"] ?? 1, 0.01)
        XCTAssertTrue(result.passesContinuity)
        XCTAssertLessThanOrEqual(result.maximumPairwiseDriftMs ?? .infinity, 250)
    }

    func testMissingTrackFailsCoverageAndDroppedFrameBudgets() {
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 27_000, mediaDuration: 899, hostDuration: 899),
            frontCamera: track(samples: 27_000, mediaDuration: 899, hostDuration: 899),
            microphone: track(samples: 42_000, mediaDuration: 899, hostDuration: 899),
            appAudio: .init(),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertFalse(result.passes)
        XCTAssertFalse(result.passesCoverage)
        XCTAssertEqual(result.coverage["appAudio"], 0)
    }

    func testDroppedFrameRatioAboveOnePercentFails() {
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 9_800, mediaDuration: 899, hostDuration: 899, dropped: 200),
            frontCamera: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            microphone: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            appAudio: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertFalse(result.passes)
        XCTAssertFalse(result.passesDroppedFrames)
        XCTAssertEqual(result.droppedFrameRatio["screen"] ?? 0, 0.02, accuracy: 0.000_001)
    }

    func testUnexpectedTwoSecondGapFailsContinuity() {
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 10_000, mediaDuration: 899, hostDuration: 899, maximumGapMs: 2_001),
            frontCamera: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            microphone: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            appAudio: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertFalse(result.passes)
        XCTAssertFalse(result.passesContinuity)
        XCTAssertEqual(result.maximumGapMs["screen"], 2_001)
    }

    func testPairwiseClockDriftAboveBudgetFails() {
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            frontCamera: track(samples: 10_000, mediaDuration: 899.4, hostDuration: 899),
            microphone: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            appAudio: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertFalse(result.passes)
        XCTAssertFalse(result.passesDrift)
        XCTAssertEqual(result.maximumPairwiseDriftMs ?? -1, 400, accuracy: 0.001)
    }

    func testPairwiseStartOffsetAboveBudgetFailsEvenWhenDurationsMatch() {
        var delayedCamera = track(samples: 10_000, mediaDuration: 899, hostDuration: 899)
        delayedCamera.firstPTS = 10.4
        delayedCamera.lastPTS = 909.4
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            frontCamera: delayedCamera,
            microphone: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            appAudio: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertFalse(result.passesDrift)
        XCTAssertEqual(result.maximumPairwiseDriftMs ?? -1, 400, accuracy: 0.001)
    }

    func testMissingClockAnchorFailsDriftWithoutEncodingANonfiniteValue() {
        let snapshot = CaptureMetricsSnapshot(
            screen: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            frontCamera: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            microphone: track(samples: 10_000, mediaDuration: 899, hostDuration: 899),
            appAudio: .init(),
            events: [],
            errors: []
        )

        let result = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: 900)

        XCTAssertFalse(result.passesDrift)
        XCTAssertNil(result.maximumPairwiseDriftMs)
    }

    private func track(
        samples: Int,
        mediaDuration: Double,
        hostDuration: Double,
        dropped: Int = 0,
        maximumGapMs: Double = 34
    ) -> CaptureTrackMetrics {
        CaptureTrackMetrics(
            samples: samples,
            invalidSamples: 0,
            droppedBuffers: dropped,
            firstPTS: 10,
            lastPTS: 10 + mediaDuration,
            firstHostNs: 1_000_000_000,
            lastHostNs: 1_000_000_000 + UInt64(hostDuration * 1_000_000_000),
            maximumGapMs: maximumGapMs
        )
    }
}
