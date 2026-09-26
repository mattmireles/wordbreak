import XCTest
@testable import Wordbreak

final class ExperimentConfigurationTests: XCTestCase {
    func testBundledKillSwitchesDefaultToSafeObservationMode() {
        XCTAssertFalse(ExperimentConfiguration.captureEnabled)
        XCTAssertFalse(ExperimentConfiguration.uploadEnabled)
        XCTAssertFalse(ExperimentConfiguration.analysisEnabled)
        XCTAssertFalse(ExperimentConfiguration.agentWriteEnabled)
        XCTAssertFalse(ExperimentConfiguration.automatedInstallEnabled)
        XCTAssertTrue(ExperimentConfiguration.notificationsEnabled)
        XCTAssertTrue(ExperimentConfiguration.screenTimeEnabled)
    }
}
