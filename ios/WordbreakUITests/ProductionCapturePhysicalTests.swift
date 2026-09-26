import XCTest

final class ProductionCapturePhysicalTests: XCTestCase {
    @MainActor
    func testProductionCaptureWritesRequiredTracks() throws {
        guard ProcessInfo.processInfo.environment["WORDBREAK_RUN_PHYSICAL_CAPTURE"] == "1" else {
            throw XCTSkip("Run explicitly on Luca's physical device.")
        }
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--production-capture-smoke"]
        app.launchEnvironment["WORDBREAK_CAPTURE_SMOKE_SECONDS"] = "8"

        addUIInterruptionMonitor(withDescription: "Production capture permissions") { alert in
            for title in ["Allow", "Allow While Using App", "Continue", "Start Recording", "OK"] {
                let button = alert.buttons[title]
                if button.exists {
                    button.tap()
                    return true
                }
            }
            return false
        }

        app.launch()
        for _ in 0..<5 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35)).tap()
            sleep(1)
        }
        let verdict = app.staticTexts["productionCapture.verdict"]
        XCTAssertTrue(verdict.waitForExistence(timeout: 30))
        XCTAssertEqual(verdict.label, "PASS")
    }
}
