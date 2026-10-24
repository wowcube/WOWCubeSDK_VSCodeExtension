"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoundAudio = void 0;
const vscode = require("vscode");
const SoundValidation = require("../media/soundvalidation");
class SoundAudio {
    static async read(project, source, preview = false) {
        if (SoundValidation.sourceIssues({ name: 'Sound', source }).length) {
            return { info: { code: 'S-003', error: 'The source must be inside the project folder.' } };
        }
        const uri = vscode.Uri.joinPath(project, source);
        let stat;
        try {
            stat = await vscode.workspace.fs.stat(uri);
            if (!(stat.type & vscode.FileType.File)) {
                throw new Error();
            }
        }
        catch {
            return { info: { code: 'S-001', error: 'Source file ' + source + ' was not found or cannot be read.' } };
        }
        const key = uri.toString() + ':' + stat.mtime + ':' + stat.size;
        if (!preview && this.infoCache.has(key)) {
            return this.infoCache.get(key);
        }
        if (!this.cache.has(key)) {
            const load = this.analyze(uri, source);
            this.cache.set(key, load);
            for (const previous of this.infoCache.keys()) {
                if (previous.startsWith(uri.toString() + ':')) {
                    this.infoCache.delete(previous);
                }
            }
            this.infoCache.set(key, load.then(result => ({ info: result.info })));
            while (this.cache.size > 24) {
                this.cache.delete(this.cache.keys().next().value);
            }
        }
        return this.cache.get(key);
    }
    static async analyze(uri, source) {
        if (!/\.(wav|mp3)$/i.test(source)) {
            return { info: { code: 'S-002', error: source + ' is not a supported audio file. Choose WAV or MP3.' } };
        }
        let bytes;
        try {
            bytes = Buffer.from(await vscode.workspace.fs.readFile(uri));
        }
        catch {
            return { info: { code: 'S-001', error: 'Source file ' + source + ' was not found or cannot be read.' } };
        }
        try {
            let decoded;
            if (/\.wav$/i.test(source)) {
                decoded = this.decodeWav(bytes);
            }
            else if (/\.mp3$/i.test(source)) {
                const decoder = await require('../media/audiodecoder.cjs').create();
                try {
                    const result = decoder.decode(bytes);
                    if (!result.samplesDecoded || result.errors.length) {
                        throw new Error('Cannot decode MP3');
                    }
                    decoded = { channelData: result.channelData, sampleRate: result.sampleRate, channels: this.mp3Channels(bytes) };
                }
                finally {
                    decoder.free();
                }
            }
            else {
                throw new Error('Unsupported format');
            }
            return this.process(decoded, bytes.length, /\.mp3$/i.test(source) ? 'MP3' : 'WAV');
        }
        catch {
            return { info: { code: 'S-002', error: source + ' is not a supported or decodable audio file. Choose PCM WAV (8/16/24-bit), float WAV (32-bit), or MP3.' } };
        }
    }
    static decodeWav(data) {
        if (data.length < 12 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
            throw new Error('Invalid WAV');
        }
        let fmt, pcm;
        for (let offset = 12; offset + 8 <= data.length;) {
            const size = data.readUInt32LE(offset + 4), type = data.toString('ascii', offset, offset + 4);
            offset += 8;
            if (offset + size > data.length) {
                throw new Error('Truncated WAV');
            }
            if (type === 'fmt ') {
                fmt = data.subarray(offset, offset + size);
            }
            if (type === 'data') {
                pcm = data.subarray(offset, offset + size);
            }
            offset += size + size % 2;
        }
        if (!fmt || fmt.length < 16 || !pcm) {
            throw new Error('Missing WAV data');
        }
        let type = fmt.readUInt16LE(0);
        const channels = fmt.readUInt16LE(2), sampleRate = fmt.readUInt32LE(4), align = fmt.readUInt16LE(12), bits = fmt.readUInt16LE(14);
        if (type === 65534 && fmt.length >= 40) {
            type = fmt.readUInt16LE(24);
        }
        if (![1, 2].includes(channels) || !sampleRate || align !== channels * bits / 8 || pcm.length % align || !(type === 1 && [8, 16, 24].includes(bits) || type === 3 && bits === 32)) {
            throw new Error('Unsupported WAV encoding');
        }
        const channelData = Array.from({ length: channels }, () => new Float32Array(pcm.length / align));
        for (let frame = 0; frame < channelData[0].length; frame++) {
            for (let c = 0; c < channels; c++) {
                const offset = frame * align + c * bits / 8, value = type === 3 ? pcm.readFloatLE(offset) : bits === 8 ? (pcm[offset] - 128) / 128 : bits === 16 ? pcm.readInt16LE(offset) / 32768 : pcm.readIntLE(offset, 3) / 8388608;
                if (!Number.isFinite(value)) {
                    throw new Error('Invalid sample');
                }
                channelData[c][frame] = value;
            }
        }
        return { channelData, sampleRate, channels };
    }
    static mp3Channels(bytes) {
        let start = 0;
        if (bytes.toString('ascii', 0, 3) === 'ID3' && bytes.length >= 10) {
            start = 10 + ((bytes[6] & 127) * 2097152 + (bytes[7] & 127) * 16384 + (bytes[8] & 127) * 128 + (bytes[9] & 127));
        }
        for (let i = start; i + 4 < bytes.length; i++) {
            if (bytes[i] === 255 && (bytes[i + 1] & 224) === 224 && (bytes[i + 1] & 6) === 2) {
                return (bytes[i + 3] >> 6) === 3 ? 1 : 2;
            }
        }
        throw new Error('No MP3 frame');
    }
    static process(decoded, fileSize, format) {
        const { channelData, sampleRate, channels } = decoded, length = channelData[0].length, duration = length / sampleRate;
        const mono = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            for (const channel of channelData) {
                mono[i] += channel[i] / channelData.length;
            }
        }
        const converted = new Float32Array(Math.round(duration * 22050)), ratio = sampleRate / 22050, cutoff = Math.min(1, 1 / ratio);
        for (let i = 0; i < converted.length; i++) {
            if (sampleRate === 22050) {
                converted[i] = mono[i];
                continue;
            }
            const center = i * ratio;
            let value = 0, total = 0;
            for (let j = Math.ceil(center - 16); j <= Math.floor(center + 16); j++) {
                if (j < 0 || j >= length) {
                    continue;
                }
                const d = center - j, a = Math.PI * d * cutoff;
                const weight = (Math.abs(a) < 1e-8 ? cutoff : Math.sin(a) / (Math.PI * d)) * (.5 + .5 * Math.cos(Math.PI * d / 16));
                value += mono[j] * weight;
                total += weight;
            }
            converted[i] = total ? value / total : 0;
        }
        let peak = 0, first = converted.length;
        const waveform = [];
        for (let i = 0; i < converted.length; i++) {
            const value = Math.abs(converted[i]);
            peak = Math.max(peak, value);
            if (value >= .001 && first === converted.length) {
                first = i;
            }
        }
        for (let bin = 0; bin < 512; bin++) {
            let value = 0;
            for (let i = Math.floor(bin * converted.length / 512); i < Math.floor((bin + 1) * converted.length / 512); i++) {
                value = Math.max(value, Math.abs(converted[i]));
            }
            waveform.push(value);
        }
        const wav = Buffer.alloc(44 + converted.length * 2);
        wav.write('RIFF');
        wav.writeUInt32LE(wav.length - 8, 4);
        wav.write('WAVEfmt ', 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(22050, 24);
        wav.writeUInt32LE(44100, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write('data', 36);
        wav.writeUInt32LE(converted.length * 2, 40);
        for (let i = 0; i < converted.length; i++) {
            wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(converted[i] * 32768))), 44 + i * 2);
        }
        return { info: { duration, sampleRate, channels, fileSize, format, estimatedSize: Math.ceil(Math.ceil(duration * 22050 / 576) * 104.5), peakDb: peak ? 20 * Math.log10(peak) : -120, leadingSilence: first / 22050, waveform }, preview: 'data:audio/wav;base64,' + wav.toString('base64') };
    }
}
exports.SoundAudio = SoundAudio;
SoundAudio.infoCache = new Map();
SoundAudio.cache = new Map();
//# sourceMappingURL=SoundAudio.js.map