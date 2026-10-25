const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

let busy = false;
const waits = [];
const logged = [];
const device = {mac: '01:02:03:04:05:06', name: 'Test cube'};
const channel = {show() {}, appendLine: line => logged.push(line)};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (parent?.filename.endsWith('/out/DeviceDeployment.js')) {
        if (name === './Configuration') return {Configuration: {
            isDeviceBusy: () => busy, setDeviceBusy: (_mac, value) => { busy = value; },
            getCurrentDevice: () => device, getLoggingMode: () => '0'
        }};
        if (name === './Output') return {Output: {channel: () => channel}};
        if (name === './Providers') return {Providers: {btdevices: {showWait: value => waits.push(value)}}};
    }
    return originalLoad.call(this, name, parent, isMain);
};
const {DeviceDeployment} = require('../../out/DeviceDeployment');
Module._load = originalLoad;
const originalCommand = DeviceDeployment.command;
const originalTimeout = global.setTimeout;
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wowcube-deployment-'));
const source = path.join(fixture, 'test.oct');
fs.writeFileSync(source, 'package');
const application = {guid1: 'FEDCBA9876543210', guid2: '0'};
const matching = 'Test App (v1.0) guid1=fedcba9876543210 guid2=0000000000000000\r\n';
const unrelated = 'Other App (v1.0) guid1=1111111111111111 guid2=0000000000000000\r\n';

async function run() {
    try {
        for (const visibleAt of [1, 3, 6, Infinity]) {
            const calls = [];
            const delays = [];
            let refreshes = 0;
            global.setTimeout = (callback, milliseconds) => {
                assert.strictEqual(busy, true, 'Device must remain busy throughout the retry and launch waits.');
                delays.push(milliseconds);
                return setImmediate(callback);
            };
            DeviceDeployment.command = async args => {
                assert.strictEqual(busy, true);
                calls.push(args);
                if (args[0] === 'ci') return ++refreshes >= visibleAt ? unrelated+matching : unrelated;
                return '';
            };
            const deployment = DeviceDeployment.uploadAndRun(source, application);
            if (visibleAt === Infinity) {
                await assert.rejects(deployment, /application is not in the device application list after 5 retries/);
                assert.strictEqual(refreshes, 6);
                assert.deepStrictEqual(delays, [2000, 2000, 2000, 2000, 2000]);
                assert.strictEqual(calls.filter(args => args[0] === 'ra').length, 0);
            } else {
                await deployment;
                assert.strictEqual(refreshes, visibleAt, 'Stop refreshing as soon as the application appears.');
                assert.deepStrictEqual(delays, [...Array(visibleAt-1).fill(2000), 1000]);
                assert.deepStrictEqual(calls.at(-1), ['ra', '-g1', 'fedcba9876543210', '-g2', '0000000000000000', '-a', device.mac]);
                assert.strictEqual(calls.filter(args => args[0] === 'ra').length, 1);
            }
            assert.strictEqual(calls.filter(args => args[0] === 'up').length, 1, 'Retries must not repeat the upload.');
            assert.strictEqual(busy, false);
            assert.deepStrictEqual(waits.slice(-2), [true, false]);
        }
        assert.ok(logged.some(line => line.includes('(5/5)')));
        console.log('Device deployment retry tests passed.');
    } finally {
        global.setTimeout = originalTimeout;
        DeviceDeployment.command = originalCommand;
        fs.rmSync(fixture, {recursive: true, force: true});
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
