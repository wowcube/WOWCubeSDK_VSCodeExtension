import * as vscode from "vscode";
import * as os from 'os';
import * as path from 'path';

function LoadCanvas(extensionUri: vscode.Uri): any 
{
  const platform = os.platform(); // e.g., 'darwin' for macOS, 'win32' for Windows
  const arch = os.arch();         // e.g., 'x64' for 64-bit architecture

  // Define the path to the correct binary based on the OS and architecture
  const binaryPath = extensionUri.fsPath+`/prebuilds/${platform}-${arch}/build/Release/canvas.node`;
  const wrapperPath = extensionUri.fsPath+`/prebuilds/${platform}-${arch}/index.js`;

  try 
  {
    // Dynamically load the canvas binary
    const bindings = require(binaryPath);
    const wrapper = require(wrapperPath);

    if(typeof wrapper._initialize === 'function')
    {
        wrapper._initialize(bindings);
    }
    return wrapper;
  }
  catch (err) 
  {
    console.error(`Failed to load canvas binary for ${platform}-${arch}:`, err);
    return null;
  }
}

export { LoadCanvas };