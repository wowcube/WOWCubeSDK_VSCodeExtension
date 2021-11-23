// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    
    document.querySelector('.bt-scan-button').addEventListener('click', () => 
    {
        vscode.postMessage({ type: 'buttonPressed', value: "" });
    });
    

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
    });
}());