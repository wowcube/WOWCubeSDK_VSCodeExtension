import * as vscode from "vscode";
import { deepStrictEqual } from "assert";
import { WizardViewProvider } from './WizardViewProvider';
import { BTDeviceViewProvider } from './BTDeviceViewProvider';
import { SettingsViewProvider } from './SettingsViewProvider';
import { ExamplesViewProvider } from './ExamplesViewProvider';
import {WOWCubeProjectProvider} from './WOWCubeProjectProvider';
import { Configuration } from "./Configuration";

export class Providers 
{
    static wizard:WizardViewProvider;
    static btdevices:BTDeviceViewProvider;
    static settings:SettingsViewProvider;
    static examples:ExamplesViewProvider;
    static project:WOWCubeProjectProvider;

    public static init(extensionUri:vscode.Uri)
    {
        Providers.wizard = new WizardViewProvider(extensionUri);
        Providers.btdevices = new BTDeviceViewProvider(extensionUri);
        Providers.settings = new SettingsViewProvider(extensionUri);
        Providers.examples = new ExamplesViewProvider(extensionUri);
        Providers.project = new WOWCubeProjectProvider(Configuration.context);
    }
}