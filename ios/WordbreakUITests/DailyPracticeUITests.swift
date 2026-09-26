import XCTest

final class DailyPracticeUITests: XCTestCase {
    @MainActor
    func testOneTapStartsNativeWordPractice() throws {
        let app = XCUIApplication()
        app.launch()

        let start = app.buttons["practice.start"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        start.tap()
        XCTAssertTrue(app.descendants(matching: .any)["wordbreak.practice"].waitForExistence(timeout: 10))
    }
}
