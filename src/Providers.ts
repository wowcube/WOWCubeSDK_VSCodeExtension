import * as vscode from "vscode";
import { deepStrictEqual } from "assert";
import { WizardViewProvider } from './WizardViewProvider';
import { BTDeviceViewProvider } from './BTDeviceViewProvider';
import { SettingsViewProvider } from './SettingsViewProvider';

export class Providers 
{
    static wizard:WizardViewProvider;
    static btdevices:BTDeviceViewProvider;
    static settings:SettingsViewProvider;

    public static init(extensionUri:vscode.Uri)
    {
        Providers.wizard = new WizardViewProvider(extensionUri);
        Providers.btdevices = new BTDeviceViewProvider(extensionUri);
        Providers.settings = new SettingsViewProvider(extensionUri);
    }
}