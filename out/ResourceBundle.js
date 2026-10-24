"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceBundles = exports.ResourceTypes = exports.hiddenSpriteModes = void 0;
exports.isResourcePath = isResourcePath;
const PaletteCompatibility = require("../media/palettecompatibility");
const ResourceValidation = require("../media/resourcevalidation");
const SpriteSequence_1 = require("./SpriteSequence");
const SoundResource_1 = require("./SoundResource");
const SoundValidation = require("../media/soundvalidation");
const FontResource_1 = require("./FontResource");
const MapResource_1 = require("./MapResource");
// These modes are preserved for future support but never offered by the editor.
exports.hiddenSpriteModes = { color: ['rgb6666'], blend: ['bump', 'dudv', 'refl'] };
function isNumber(value, min, max = Infinity) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
// All paths are relative to the bundle's project folder, including source folders.
function isResourcePath(value, allowRoot = false) {
    return typeof value === 'string' && (allowRoot && value === '.' ||
        value.length > 0 && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') &&
            !value.split('/').some(part => part === '..' || part === '.' || part.length === 0));
}
class ResourceTypes {
    static register(resourceType) {
        if (this.types.has(resourceType.type)) {
            throw new Error('Resource type is already registered: ' + resourceType.type);
        }
        this.types.set(resourceType.type, resourceType);
    }
    static get(type) {
        return this.types.get(type);
    }
    static getAll() {
        return Array.from(this.types.values());
    }
}
exports.ResourceTypes = ResourceTypes;
ResourceTypes.types = new Map();
ResourceTypes.register({
    type: 'palette',
    label: 'Palette',
    canCreate: false,
    create: (id, name) => ({ id, name, type: 'palette', colors: ['#00000000', '#ffffff'], mappingColors: ['#00000000', '#ffffff'], colorCount: 256, transparentIndex: 0 }),
    getReferences: () => [],
    validate: (resource) => {
        const errors = [];
        const colors = resource.colors;
        if (ResourceValidation.paletteSize(resource.colorCount)) {
            errors.push(ResourceValidation.paletteSize(resource.colorCount));
        }
        if (!Array.isArray(colors) || colors.length < 1 || colors.length > 256 ||
            colors.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))) {
            errors.push('Palette must contain 1–256 colors in #RRGGBB or #RRGGBBAA format.');
        }
        if (Array.isArray(colors) && typeof resource.colorCount === 'number' && colors.length > resource.colorCount) {
            errors.push('V-015: Palette colors exceed the requested palette size.');
        }
        if (resource.transparentIndex !== null && (!Number.isInteger(resource.transparentIndex) ||
            !isNumber(resource.transparentIndex, 0, Array.isArray(colors) ? colors.length - 1 : -1))) {
            errors.push('Transparent index must be null or a valid palette index.');
        }
        if ((!Array.isArray(resource.mappingColors) || !Array.isArray(colors) ||
            resource.mappingColors.length !== colors.length || resource.mappingColors.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)))) {
            errors.push('Palette mapping colors must contain one valid RGB or RGBA color per palette entry.');
        }
        return errors;
    }
});
ResourceTypes.register({
    type: 'sprite',
    label: 'Sprite',
    getPaletteSource: (resource) => resource.colorMode === 'palette' && typeof resource.source === 'string' ? resource.source : undefined,
    create: (id, name, source = '', options = {}) => ({
        id, name, type: 'sprite', source, colorMode: options.colorMode === 'rgb565' ? 'rgb565' : 'palette',
        paletteId: options.colorMode !== 'rgb565' && typeof options.paletteId === 'string' && options.paletteId ? options.paletteId : null,
        blend: options.colorMode === 'rgb565' ? 'opaque' : 'alpha', fullsize: false, dither: false, compression: options.colorMode === 'rgb565' ? 'plain' : null, softkey: null,
        number: 0, frameRate: 1, group: null, objectType: null, tags: [],
        pivot: null, collider: { enabled: false, x: 0, y: 0, width: 0, height: 0 }
    }),
    getReferences: (resource) => typeof resource.paletteId === 'string' ? [resource.paletteId] : [],
    validate: (resource, bundle) => {
        const errors = [];
        if (!isResourcePath(resource.source)) {
            errors.push('V-006: Sprite source must be a project-relative PNG file path.');
        }
        else if (!/\.png$/i.test(resource.source)) {
            errors.push('V-006: Sprite sources must be PNG files.');
        }
        if (resource.colorMode === 'palette' && !bundle.resources.some(item => item.id === resource.paletteId && item.type === 'palette')) {
            errors.push('V-014: Sprite palette must reference an existing palette.');
        }
        if (typeof resource.colorMode !== 'string' || !['palette', 'rgb565', ...exports.hiddenSpriteModes.color].includes(resource.colorMode)) {
            errors.push('Unknown sprite color mode.');
        }
        if (typeof resource.blend !== 'string' || !['opaque', 'alpha', 'additive', 'bg', ...exports.hiddenSpriteModes.blend].includes(resource.blend)) {
            errors.push('Unknown sprite blend mode.');
        }
        if (resource.colorMode === 'rgb565' && (resource.paletteId !== null || resource.blend !== 'opaque')) {
            errors.push('V-019: RGB565 sprites require Opaque blend and no palette.');
        }
        if (resource.colorMode !== 'rgb565' && resource.dither) {
            errors.push('Dithering is available only for RGB565.');
        }
        for (const key of ['fullsize', 'dither']) {
            if (typeof resource[key] !== 'boolean') {
                errors.push(key + ' must be a boolean.');
            }
        }
        if (resource.colorMode === 'rgb565' ? !['plain', 'softkey'].includes(resource.compression) : resource.compression !== null) {
            errors.push('V-020: RGB565 requires Plain or Softkey encoding; other color modes must leave compression unset.');
        }
        const softkey = resource.softkey;
        if (resource.compression === 'softkey' && (!softkey || typeof softkey.key !== 'string' || !/^#[0-9a-f]{6}$/i.test(softkey.key) || ResourceValidation.integer(softkey.threshold, 0, 255, 'V-020', 'Softkey threshold'))) {
            errors.push('V-020: Softkey requires a #RRGGBB color and an integer threshold from 0 to 255.');
        }
        if (resource.compression !== 'softkey' && softkey != null) {
            errors.push('V-020: Softkey settings require Softkey encoding.');
        }
        for (const [key, min, max] of [['number', -32768, 32767], ['frameRate', resource.sequence ? 0 : 1, 127]]) {
            if (!Number.isInteger(resource[key]) || !isNumber(resource[key], min, max)) {
                errors.push(ResourceValidation.integer(resource[key], min, max, key === 'number' ? 'V-011' : 'V-010', key));
            }
        }
        for (const [key, registry] of [['group', 'groups'], ['objectType', 'types']]) {
            if (resource[key] !== null && !bundle.registries[registry].includes(resource[key])) {
                errors.push('V-013: Sprite references an unknown ' + key + '.');
            }
        }
        if (!Array.isArray(resource.tags) || new Set(resource.tags).size !== resource.tags.length || resource.tags.some(tag => !bundle.registries.tags.includes(tag))) {
            errors.push('V-013: Sprite tags must reference registered tags.');
        }
        const pivot = resource.pivot;
        if (pivot !== null && (!pivot || ![pivot.x, pivot.y].every(value => typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value * 2)))) {
            errors.push('V-009: Pivot coordinates must be finite multiples of 0.5 in source pixels, or null for center.');
        }
        const collider = resource.collider;
        if (!collider || typeof collider.enabled !== 'boolean' ||
            ![collider.x, collider.y, collider.width, collider.height].every(value => isNumber(value, 0))) {
            errors.push('Collider coordinates and dimensions must be finite, nonnegative numbers.');
        }
        return errors;
    }
});
ResourceTypes.register(MapResource_1.mapResourceType);
ResourceTypes.register(FontResource_1.fontResourceType);
ResourceTypes.register(SoundResource_1.soundResourceType);
class ResourceBundles {
    static create() {
        return { schemaVersion: 2, sourceFolders: [], resources: [], registries: { groups: [], types: [], tags: [] } };
    }
    static parse(text) {
        const bundle = JSON.parse(text);
        const errors = this.validate(bundle);
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
        return bundle;
    }
    static validate(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return ['Resource bundle must be a JSON object.'];
        }
        const bundle = value;
        if (bundle.schemaVersion !== 2) {
            return ['Unsupported resource bundle schema version. Expected 2. Create a new resource bundle.'];
        }
        if (!Array.isArray(bundle.sourceFolders) || !bundle.sourceFolders.every(folder => isResourcePath(folder, true))) {
            return ['Source folders must be project-relative paths.'];
        }
        if (!Array.isArray(bundle.resources)) {
            return ['Resources must be an array.'];
        }
        if (!bundle.registries || typeof bundle.registries !== 'object' || Array.isArray(bundle.registries)) {
            return ['Invalid sprite registries.'];
        }
        for (const [key, limit] of [['groups', 255], ['types', 255], ['tags', 32]]) {
            const entries = bundle.registries[key];
            if (!Array.isArray(entries) || entries.length > limit || entries.some(entry => typeof entry !== 'string' || !entry.trim() || entry !== entry.trim()) || new Set(entries).size !== entries.length) {
                return ['V-012: Registry ' + key + ' requires unique names and at most ' + limit + ' entries.'];
            }
        }
        const errors = [];
        const ids = new Set();
        const names = new Set();
        for (const resource of bundle.resources) {
            if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
                errors.push('Each resource must be an object.');
                continue;
            }
            if (typeof resource.id !== 'string' || resource.id.length === 0 || ids.has(resource.id)) {
                errors.push('Resource IDs must be nonempty and unique.');
            }
            if (typeof resource.name !== 'string' || resource.type !== 'sound' && (!resource.name.trim() || resource.name !== resource.name.trim() || names.has(resource.name))) {
                errors.push('V-004: Resource names must be nonempty, trimmed, and unique.');
            }
            if (['sprite', 'palette', 'map', 'font'].includes(resource.type)) {
                const error = ResourceValidation.name(resource.name, [], resource.type);
                if (error) {
                    errors.push(error);
                }
            }
            if (typeof resource.type !== 'string' || !resource.type) {
                errors.push('Resource type is required.');
            }
            ids.add(resource.id);
            if (resource.type !== 'sound') {
                names.add(resource.name);
            }
        }
        if (errors.length > 0) {
            return errors;
        }
        for (const resource of bundle.resources) {
            // Resource descriptors validate supported types; extension data stays intact.
            const resourceType = ResourceTypes.get(resource.type);
            if (resourceType) {
                errors.push(...resourceType.validate(resource, bundle).map(error => resource.name + ': ' + error));
            }
        }
        errors.push(...SpriteSequence_1.SpriteSequences.validate(bundle));
        const fonts = bundle.resources.filter(resource => resource.type === 'font');
        if (fonts.length > 3) {
            errors.push('Only three fonts are supported (slots 1–3).');
        }
        const palettes = bundle.resources.filter(resource => resource.type === 'palette');
        if (palettes.length > ResourceValidation.maxPalettes) {
            errors.push('V-016: At most ' + ResourceValidation.maxPalettes + ' palettes are allowed.');
        }
        if (1 + bundle.resources.filter(resource => ['sprite', 'palette', 'map'].includes(resource.type)).length > 5120) {
            errors.push('V-025: At most 5120 runtime assets are allowed.');
        }
        for (const palette of palettes) {
            const members = bundle.resources.filter(resource => (resource.type === 'font' || resource.type === 'sprite' && resource.colorMode === 'palette') && resource.paletteId === palette.id);
            if (members.some(resource => ['alpha', 'additive'].includes(resource.blend)) && members.some(resource => ['opaque', 'bg'].includes(resource.blend))) {
                errors.push('V-017: Palette ' + palette.name + ' mixes alpha and opaque sprites.');
            }
        }
        return errors;
    }
    static getBuildErrors(bundle) {
        return [...bundle.resources.filter(resource => resource.type === 'sound').flatMap(resource => [...SoundValidation.nameIssues(resource, bundle.resources), ...SoundValidation.sourceIssues(resource)].map(issue => issue.message)), ...(1 + bundle.resources.filter(resource => ['sprite', 'palette', 'map', 'sound'].includes(resource.type)).length > 5120 ? ['The bundle cannot contain more than 5120 runtime assets.'] : []), ...SpriteSequence_1.SpriteSequences.buildErrors(bundle), ...bundle.resources.filter(resource => resource.type === 'palette').map(resource => PaletteCompatibility.issue(resource)).filter((error) => !!error)];
    }
    static getWarnings(bundle) {
        const warnings = this.getBuildErrors(bundle);
        const palettes = bundle.resources.filter(resource => resource.type === 'palette');
        for (const palette of palettes) {
            if (!bundle.resources.some(resource => resource.paletteId === palette.id)) {
                warnings.push('V-018: Palette ' + palette.name + ' is not used.');
            }
        }
        if (palettes.reduce((sum, resource) => sum + resource.colorCount, 0) > 4096) {
            warnings.push('V-026: Palettes total more than 4096 entries; the engine may swap palettes at runtime.');
        }
        for (const resource of bundle.resources.filter(resource => resource.type === 'sprite')) {
            if (resource.blend === 'bg') {
                warnings.push('V-031: BG currently behaves exactly like Opaque.');
            }
            if (exports.hiddenSpriteModes.blend.includes(resource.blend)) {
                warnings.push('V-027: ' + resource.name + ' uses an unsupported blend and would not be drawn.');
            }
        }
        return warnings;
    }
    static getDependents(bundle, id) {
        return bundle.resources.filter(resource => ResourceTypes.get(resource.type)?.getReferences(resource).includes(id));
    }
}
exports.ResourceBundles = ResourceBundles;
//# sourceMappingURL=ResourceBundle.js.map