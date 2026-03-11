"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Providers = void 0;
const WizardViewProvider_1 = require("./WizardViewProvider");
const BTDeviceViewProvider_1 = require("./BTDeviceViewProvider");
const SettingsViewProvider_1 = require("./SettingsViewProvider");
const ExamplesViewProvider_1 = require("./ExamplesViewProvider");
const WOWCubeProjectProvider_1 = require("./WOWCubeProjectProvider");
const Configuration_1 = require("./Configuration");
class Providers {
    static init(extensionUri) {
        Providers.wizard = new WizardViewProvider_1.WizardViewProvider(extensionUri);
        Providers.btdevices = new BTDeviceViewProvider_1.BTDeviceViewProvider(extensionUri);
        Providers.settings = new SettingsViewProvider_1.SettingsViewProvider(extensionUri);
        Providers.examples = new ExamplesViewProvider_1.ExamplesViewProvider(extensionUri);
        Providers.project = new WOWCubeProjectProvider_1.WOWCubeProjectProvider(Configuration_1.Configuration.context);
    }
}
exports.Providers = Providers;
//# sourceMappingURL=Providers.js.map