const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const {CMakeBuildCache} = require('../../out/CMakeBuildCache');

async function run() {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wowcube-cmake-cache-'));
    const oldSource = path.join(fixture, 'SDK 0.98', 'octavios');
    const newSource = path.join(fixture, 'SDK 0.100', 'octavios');
    const build = path.join(fixture, 'app', 'build-sim');
    try {
        for (const directory of [oldSource, newSource, build]) fs.mkdirSync(directory, {recursive: true});
        const cache = path.join(build, 'CMakeCache.txt');
        const metadata = path.join(build, 'CMakeFiles');
        const asset = path.join(fixture, 'app', 'asset.txt');
        const binary = path.join(build, 'existing-binary');
        fs.writeFileSync(asset, 'keep asset');
        fs.writeFileSync(binary, 'keep binary');
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), false);

        const matching = 'CMAKE_HOME_DIRECTORY:INTERNAL='+newSource+'\r\nCMAKE_CACHEFILE_DIR:INTERNAL='+build+'\r\n';
        fs.writeFileSync(cache, matching);
        fs.mkdirSync(metadata);
        fs.writeFileSync(path.join(metadata, 'compiler.txt'), 'cached compiler');
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), false);
        assert.strictEqual(fs.readFileSync(cache, 'utf8'), matching);
        assert.ok(fs.existsSync(path.join(metadata, 'compiler.txt')));

        fs.writeFileSync(cache, 'CMAKE_HOME_DIRECTORY:INTERNAL='+oldSource+'\n');
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), true);
        assert.ok(!fs.existsSync(cache));
        assert.ok(!fs.existsSync(metadata));
        assert.strictEqual(fs.readFileSync(asset, 'utf8'), 'keep asset');
        assert.strictEqual(fs.readFileSync(binary, 'utf8'), 'keep binary');

        fs.writeFileSync(cache, matching.replace(build, path.join(fixture, 'previous-location')));
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), true);
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), false);

        // Real CMake regression: reproduce the exact source mismatch, then configure successfully.
        for (const directory of [oldSource, newSource]) {
            fs.writeFileSync(path.join(directory, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.16)\nproject(CacheSwitch NONE)\n');
        }
        const configure = directory => cp.spawnSync('cmake', ['-S', directory, '-B', build], {encoding: 'utf8'});
        const first = configure(oldSource);
        assert.strictEqual(first.status, 0, first.stderr || String(first.error));
        const mismatch = configure(newSource);
        assert.notStrictEqual(mismatch.status, 0);
        assert.match(mismatch.stderr, /does not match the source/);
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), true);
        const corrected = configure(newSource);
        assert.strictEqual(corrected.status, 0, corrected.stderr);
        assert.strictEqual(await CMakeBuildCache.prepare(build, newSource), false);
        console.log('CMake cache tests passed, including actual SDK source-switch reconfiguration.');
    } finally {
        fs.rmSync(fixture, {recursive: true, force: true});
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
