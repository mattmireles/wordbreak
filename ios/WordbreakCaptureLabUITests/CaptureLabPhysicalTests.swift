import XCTest

final class CaptureLabPhysicalTests: XCTestCase {
    @MainActor
    func testFifteenMinuteCaptureMeetsEveryBudget() throws {
        continueAfterFailure = false
        let app = XCUIApplication()

        addUIInterruptionMonitor(withDescription: "Capture permissions") { alert in
            for title in ["Allow", "Allow While Using App", "Continue", "OK"] {
                let button = alert.buttons[title]
                if button.exists {
                    button.tap()
                    return true
                }
            }
            return false
        }

        app.launch()
        let open = app.buttons["capture.open"]
        XCTAssertTrue(open.waitForExistence(timeout: 20), "Capture lab did not reach its start screen")
        open.tap()

        let toggle = app.buttons["capture.toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 20), "Capture lab did not reach the device check")
        toggle.tap()

        // XCTest invokes interruption monitors on the next UI event after a
        // system alert appears. Center taps are inert on this screen once the
        // alert has been dismissed.
        for _ in 0..<4 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35)).tap()
            sleep(1)
        }

        let recording = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Recording locally")).firstMatch
        XCTAssertTrue(recording.waitForExistence(timeout: 30), "ReplayKit and front-camera capture did not start")

        let verdict = app.staticTexts["capture.verdict"]
        XCTAssertTrue(verdict.waitForExistence(timeout: 930), "The fifteen-minute capture did not produce a verdict")
        XCTAssertEqual(verdict.label, "PASS", "The physical capture receipt missed at least one declared budget")
    }
}
