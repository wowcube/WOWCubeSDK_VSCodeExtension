"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WizardViewProvider = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
class WizardViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options =
            {
                // Allow scripts in the webview
                enableScripts: true,
                localResourceRoots: [
                    this._extensionUri
                ]
            };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'buttonPressed':
                    {
                        vscode.commands.executeCommand('WOWCubeSDK.openWizard');
                        break;
                    }
                case 'buttonAdHocPressed':
                    {
                        vscode.commands.executeCommand('WOWCubeSDK.openAdHocSharing');
                        break;
                    }
            }
        });
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'wizardview.js'));
        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        // Use a nonce to only allow a specific script to be run.
        const nonce = (0, getNonce_1.getNonce)();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>New Cubeapp Wizard</title>
			</head>
			<body>
				<br/>
				<div><strong>New Cubeapp Wizard</strong> helps to create a scaffold of a new WOWCube cubeapp application project</div>
				<br/>
				<button class="open-wizard-button">Open New Cubeapp Wizard</button>
				<br/>
				<div>Share your cubeapp applications with your friends and team members with <strong>Ad-Hoc Sharing</strong></div>
				<br/>
				<button class="share-adhoc-button">Share Ad-Hoc Cubeapp</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
exports.WizardViewProvider = WizardViewProvider;
WizardViewProvider.viewType = 'WOWCubeSDK.wizardView';
//# sourceMappingURL=WizardViewProvider.js.map