// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
//    const oldState = vscode.getState() || { colors: [] };

    /** @type {Array<{ value: string }>} */
 //   let colors = oldState.colors;

    document.querySelector('.open-wizard-button').addEventListener('click', () => 
    {
        vscode.postMessage({ type: 'buttonPressed', value: "" });
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event =>  
    {
    });
}());