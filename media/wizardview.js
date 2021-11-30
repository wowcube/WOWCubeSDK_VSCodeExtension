// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    document.querySelector('.open-wizard-button').addEventListener('click', () => 
    {
        vscode.postMessage({ type: 'buttonPressed', value: "" });
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
    });
}());