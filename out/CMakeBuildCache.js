"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CMakeBuildCache = void 0;
const fs = require("fs");
const path = require("path");
class CMakeBuildCache {
    static async canonical(directory) {
        const resolved = await fs.promises.realpath(directory).catch((error) => {
            if (error.code === 'ENOENT') {
                return path.resolve(directory);
            }
            throw error;
        });
        const normalized = path.normalize(resolved);
        return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    }
    /** Keep incremental builds, but discard configuration belonging to another SDK or location. */
    static async prepare(buildDirectory, sourceDirectory) {
        const cacheFile = path.join(buildDirectory, 'CMakeCache.txt');
        let cache;
        try {
            cache = await fs.promises.readFile(cacheFile, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
        const source = /^CMAKE_HOME_DIRECTORY:INTERNAL=([^\r\n]+)\r?$/m.exec(cache)?.[1];
        const build = /^CMAKE_CACHEFILE_DIR:INTERNAL=([^\r\n]+)\r?$/m.exec(cache)?.[1];
        const sourceChanged = source !== undefined &&
            await this.canonical(source) !== await this.canonical(sourceDirectory);
        const buildMoved = build !== undefined &&
            await this.canonical(build) !== await this.canonical(buildDirectory);
        if (!sourceChanged && !buildMoved) {
            return false;
        }
        // Equivalent cache reset to CMake --fresh, including CMake versions before 3.24.
        // Leave application sources, assets, binaries, and the rest of the build tree intact.
        await fs.promises.rm(path.join(buildDirectory, 'CMakeFiles'), { recursive: true, force: true });
        await fs.promises.rm(cacheFile, { force: true });
        return true;
    }
}
exports.CMakeBuildCache = CMakeBuildCache;
//# sourceMappingURL=CMakeBuildCache.js.map