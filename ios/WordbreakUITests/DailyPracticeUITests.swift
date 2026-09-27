import XCTest

final class DailyPracticeUITests: XCTestCase {
    @MainActor
    func testOneTapStartsNativeWordPractice() throws {
        let app = XCUIApplication()
        app.launchArguments += ["--wordbreak-reset-state"]
        app.launch()

        let start = app.buttons["practice.start"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        start.tap()
        XCTAssertTrue(app.descendants(matching: .any)["wordbreak.practice"].waitForExistence(timeout: 10))
    }

    @MainActor
    func testLearnerPathShowsNoParentOrExperimentControls() throws {
        let app = XCUIApplication()
        app.launchArguments += ["--wordbreak-reset-state"]
        app.launch()
        XCTAssertTrue(app.buttons["practice.start"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Parent setup"].exists)
        XCTAssertFalse(app.navigationBars.buttons.firstMatch.exists, "The learner home has no toolbar controls")
        XCTAssertFalse(app.descendants(matching: .any)["capture.indicator"].exists)
    }

    @MainActor
    func testLearnerScreensPassTheSystemAccessibilityAudit() throws {
        let app = XCUIApplication()
        app.launchArguments += ["--wordbreak-reset-state"]
        app.launch()
        XCTAssertTrue(app.buttons["practice.start"].waitForExistence(timeout: 10))
        try audit(app, screen: "home")
        app.buttons["practice.start"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["wordbreak.practice"].waitForExistence(timeout: 10))
        try audit(app, screen: "wordbreak lesson")
        app.buttons["Try the words"].tap()
        XCTAssertTrue(app.buttons["Choose a letter"].waitForExistence(timeout: 10))
        try audit(app, screen: "wordbreak run")
    }

    /// Names each failing element so an audit regression is actionable from the log alone.
    @MainActor
    private func audit(_ app: XCUIApplication, screen: String) throws {
        var issues: [String] = []
        try app.performAccessibilityAudit { issue in
            issues.append("\(issue.compactDescription): \(issue.element?.label ?? "?") [\(issue.element?.identifier ?? "")]")
            return true
        }
        XCTAssertTrue(issues.isEmpty, "\(screen) audit: \(issues.joined(separator: "; "))")
    }

    @MainActor
    func testLargestAccessibilityTextKeepsTheStartActionReachable() throws {
        let app = XCUIApplication()
        app.launchArguments += ["--wordbreak-reset-state"]
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        let start = app.buttons["practice.start"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        XCTAssertTrue(start.isHittable)
    }
}
