import XCTest

final class ScreenTimePhysicalTests: XCTestCase {
    @MainActor
    func testSelectionAndCallbackPersistAcrossRestart() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = [
            "--wordbreak-capability-check",
            "--wordbreak-request-family-controls",
        ]
        app.launch()

        XCTAssertTrue(app.staticTexts["1 chosen"].waitForExistence(timeout: 20), "The activity selection did not survive relaunch")
        XCTAssertTrue(app.staticTexts["Check received"].waitForExistence(timeout: 20), "The monitor extension callback did not reach the shared App Group")
    }

    @MainActor
    func testSelectSocialActivityAndStartThresholdProof() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = [
            "--wordbreak-capability-check",
            "--wordbreak-request-family-controls",
            "--wordbreak-open-activity-picker",
        ]
        app.launch()

        let socialActivity = app.staticTexts["Social"]
        XCTAssertTrue(socialActivity.waitForExistence(timeout: 20), "Apple's activity picker did not appear")
        app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            .withOffset(CGVector(dx: 44, dy: socialActivity.frame.midY))
            .tap()

        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 10), "Apple's activity picker did not expose its Done button")
        done.tap()

        XCTAssertTrue(app.staticTexts["1 chosen"].waitForExistence(timeout: 10), "The activity selection did not persist in the setup view")
        let start = app.buttons["permissions.start-threshold-proof"]
        XCTAssertTrue(start.waitForExistence(timeout: 10), "The selection did not return to Wordbreak")
        XCTAssertTrue(start.isEnabled, "The threshold proof stayed disabled after selection")
        start.tap()
        XCTAssertTrue(
            app.staticTexts["running · one-minute proof window"].waitForExistence(timeout: 10),
            "DeviceActivity monitoring did not start"
        )
    }
}
