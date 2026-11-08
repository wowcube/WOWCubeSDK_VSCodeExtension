import * as fs from 'fs';
import * as path from 'path';

export class CMakeBuildCache
{
    private static async canonical(directory: string): Promise<string>
    {
        const resolved = await fs.promises.realpath(directory).catch((error: NodeJS.ErrnoException) =>
        {
            if (error.code === 'ENOENT') { return path.resolve(directory); }
            throw error;
        });
        const normalized = path.normalize(resolved);
        return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    }

    /** Keep incremental builds, but discard configuration belonging to another SDK or location. */
    public static async prepare(buildDirectory: string, sourceDirectory: string): Promise<boolean>
    {
        const cacheFile = path.join(buildDirectory, 'CMakeCache.txt');
        let cache: string;
        try { cache = await fs.promises.readFile(cacheFile, 'utf8'); }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') { return false; }
            throw error;
        }
        const source = /^CMAKE_HOME_DIRECTORY:INTERNAL=([^\r\n]+)\r?$/m.exec(cache)?.[1];
        const build = /^CMAKE_CACHEFILE_DIR:INTERNAL=([^\r\n]+)\r?$/m.exec(cache)?.[1];
        const sourceChanged = source !== undefined &&
            await this.canonical(source) !== await this.canonical(sourceDirectory);
        const buildMoved = build !== undefined &&
            await this.canonical(build) !== await this.canonical(buildDirectory);
        if (!sourceChanged && !buildMoved) { return false; }

        // Equivalent cache reset to CMake --fresh, including CMake versions before 3.24.
        // Leave application sources, assets, binaries, and the rest of the build tree intact.
        await fs.promises.rm(path.join(buildDirectory, 'CMakeFiles'), {recursive: true, force: true});
        await fs.promises.rm(cacheFile, {force: true});
        return true;
    }
}
