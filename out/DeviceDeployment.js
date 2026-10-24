"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceDeployment = void 0;
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const Configuration_1 = require("./Configuration");
const Output_1 = require("./Output");
const Providers_1 = require("./Providers");
class DeviceDeployment {
    static async upload(mac, source, application) {
        if (Configuration_1.Configuration.isDeviceBusy(mac)) {
            throw new Error('The selected WOWCube device is busy. Wait for its current operation to finish.');
        }
        const channel = Output_1.Output.channel();
        Configuration_1.Configuration.setDeviceBusy(mac, true);
        try {
            Providers_1.Providers.btdevices?.showWait(true);
            const stat = await fs.promises.stat(source).catch(() => undefined);
            if (!stat?.isFile() || stat.size === 0) {
                throw new Error('Application package is missing or empty: ' + source);
            }
            const args = ['up', '-p', source, '-a', mac];
            // Legacy CUB uploads support logging; OCT uploads do not accept these flags.
            const logging = +Configuration_1.Configuration.getLoggingMode() - 1;
            if (path.extname(source).toLowerCase() === '.cub' && logging >= 0) {
                args.push('-l', '-cid', String(logging));
            }
            channel.show(true);
            const device = Configuration_1.Configuration.getCurrentDevice();
            const destination = device?.mac === mac && device.name ? device.name + ' (' + mac + ')' : mac;
            channel.appendLine('Uploading ' + path.basename(source) + ' to ' + destination + '...');
            await DeviceDeployment.command(args, 'upload');
            channel.appendLine('Upload complete.');
            if (application) {
                channel.appendLine('Refreshing installed applications...');
                const catalog = await DeviceDeployment.command(['ci', '-f', '-c', '-al', '-a', mac], 'application list refresh');
                const guid1 = application.guid1.toLowerCase().padStart(16, '0');
                const guid2 = application.guid2.toLowerCase().padStart(16, '0');
                const app = Array.from(catalog.matchAll(/^(.+) \(([^\r\n]*)\) guid1=([0-9a-fA-F]{16}) guid2=([0-9a-fA-F]{16})\r?$/gm))
                    .find(entry => entry[3].toLowerCase() === guid1 && entry[4].toLowerCase() === guid2);
                if (!app) {
                    throw new Error('Upload completed, but the application is not in the device application list. Open WOWCube Device Details and refresh its application list.');
                }
                channel.appendLine('Waiting one second before launch...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                channel.appendLine('Starting ' + app[1] + '...');
                await DeviceDeployment.command(['ra', '-g1', app[3], '-g2', app[4], '-a', mac], 'launch');
                channel.appendLine('Launch command sent.');
            }
        }
        finally {
            Configuration_1.Configuration.setDeviceBusy(mac, false);
            Providers_1.Providers.btdevices?.showWait(false);
        }
    }
    static async command(args, operation) {
        const channel = Output_1.Output.channel();
        return new Promise((resolve, reject) => {
            let failed = false;
            let pending = '';
            let stdout = '';
            const proc = cp.spawn(path.join(Configuration_1.Configuration.getUtilsPath(), Configuration_1.Configuration.getLoader()), args, { env: process.env, windowsHide: true });
            const output = (data) => {
                const text = data.toString();
                channel.append(text);
                // Some loader versions report an error in their output despite returning zero.
                pending = (pending + text).slice(-8192);
                if (/\berror:/i.test(pending)) {
                    failed = true;
                }
            };
            proc.stdout?.on('data', (data) => { stdout += data.toString(); output(data); });
            proc.stderr?.on('data', output);
            proc.once('error', reject);
            proc.once('close', code => code === 0 && !failed ? resolve(stdout) : reject(new Error('Device ' + operation + ' failed' + (code === null ? '.' : ' (exit code ' + code + ').') + ' See Output for details.')));
        });
    }
    static async uploadAndRun(source, application) {
        const device = Configuration_1.Configuration.getCurrentDevice();
        if (!device?.mac) {
            throw new Error('No WOWCube device selected. Select a device in WOWCube Devices, then build again.');
        }
        if (!application || ![application.guid1, application.guid2].every(value => typeof value === 'string' && /^[0-9a-fA-F]{1,16}$/.test(value))) {
            throw new Error('Cannot launch the application: metadata.application.guid1 and guid2 must be hexadecimal strings of 1–16 digits in wowcubeapp-build.json.');
        }
        await DeviceDeployment.upload(device.mac, source, application);
    }
}
exports.DeviceDeployment = DeviceDeployment;
//# sourceMappingURL=DeviceDeployment.js.map