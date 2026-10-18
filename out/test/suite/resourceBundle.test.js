"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const ResourceBundle_1 = require("../../ResourceBundle");
const ResourceValidation = require("../../../media/resourcevalidation");
suite('Resource bundle', () => {
    function createBundle() {
        const bundle = ResourceBundle_1.ResourceBundles.create();
        const palette = ResourceBundle_1.ResourceTypes.get('palette').create('palette-1', 'world');
        const sprite = ResourceBundle_1.ResourceTypes.get('sprite').create('sprite-1', 'hero', 'characters/hero.png', { paletteId: palette.id });
        bundle.resources.push(palette, sprite);
        bundle.sourceFolders = ['characters', 'other/art'];
        return { bundle, palette, sprite };
    }
    test('round trips one bundle with multiple source folders and stable references', () => {
        const { bundle, palette, sprite } = createBundle();
        palette.name = 'renamed_palette';
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.parse(JSON.stringify(bundle)), bundle);
        assert.strictEqual(sprite.paletteId, palette.id);
        assert.strictEqual(sprite.pivot, null);
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.getDependents(bundle, palette.id), [sprite]);
    });
    test('accepts generated color arrays up to 256 entries and rejects malformed colors', () => {
        const { bundle, palette } = createBundle();
        palette.colors = Array(256).fill('#12ABef');
        palette.mappingColors = palette.colors.slice();
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        palette.colors.push('#000000');
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /1–256/);
        palette.colors = ['#000000'];
        palette.mappingColors = palette.colors.slice();
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        palette.colors = ['#12345680', '#abcdef00'];
        palette.mappingColors = palette.colors.slice();
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        palette.mappingColors = ['#ffffff', '#000000'];
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.parse(JSON.stringify(bundle)).resources[0].mappingColors, palette.mappingColors);
        palette.mappingColors = ['#ffffff'];
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /mapping colors/);
        delete palette.mappingColors;
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /mapping colors/);
        palette.colors = [];
        palette.mappingColors = palette.colors.slice();
        assert.ok(ResourceBundle_1.ResourceBundles.validate(bundle).length);
        palette.colors = ['#000000', 'red'];
        palette.mappingColors = palette.colors.slice();
        assert.ok(ResourceBundle_1.ResourceBundles.validate(bundle).length);
    });
    test('rejects out-of-range transparency, pivots, and colliders', () => {
        const { bundle, palette, sprite } = createBundle();
        palette.transparentIndex = 2;
        sprite.pivot = { x: 0.1, y: 0 };
        sprite.collider.width = NaN;
        assert.strictEqual(ResourceBundle_1.ResourceBundles.validate(bundle).length, 3);
        palette.transparentIndex = 0;
        sprite.pivot = { x: 0, y: 0 };
        sprite.collider.width = 0;
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
    });
    test('rejects duplicate names and IDs across resource types', () => {
        const { bundle, palette, sprite } = createBundle();
        sprite.name = palette.name;
        sprite.id = palette.id;
        assert.strictEqual(ResourceBundle_1.ResourceBundles.validate(bundle).length, 2);
    });
    test('rejects dangling references and references to the wrong resource type', () => {
        const { bundle, sprite } = createBundle();
        sprite.paletteId = 'missing';
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /existing palette/);
        sprite.paletteId = sprite.id;
        assert.ok(ResourceBundle_1.ResourceBundles.validate(bundle).length);
        sprite.paletteId = null;
        assert.ok(ResourceBundle_1.ResourceBundles.validate(bundle).length);
        sprite.colorMode = 'rgb565';
        sprite.blend = 'opaque';
        sprite.compression = 'plain';
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
    });
    test('permits sources outside configured folders without implicitly registering files', () => {
        const { bundle, sprite } = createBundle();
        bundle.sourceFolders = [];
        sprite.source = 'arbitrary/folder/image.png';
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        assert.strictEqual(ResourceBundle_1.ResourceBundles.create().resources.length, 0);
    });
    test('rejects absolute paths and traversal while permitting Unicode names', () => {
        for (const value of ['../outside', '/absolute', 'C:/absolute', 'a/../b', 'a\\b', 'a//b', './a', 'a/']) {
            assert.strictEqual((0, ResourceBundle_1.isResourcePath)(value, true), false, value);
        }
        assert.strictEqual((0, ResourceBundle_1.isResourcePath)('графіка/hero.png'), true);
        assert.strictEqual((0, ResourceBundle_1.isResourcePath)('.', true), true);
        assert.strictEqual((0, ResourceBundle_1.isResourcePath)('.'), false);
    });
    test('preserves future resource types and extension fields', () => {
        const { bundle } = createBundle();
        bundle.customSettings = { future: true };
        bundle.resources.push({ id: 'map-1', name: 'level', type: 'future-map', layers: [{ tiles: [1, 2] }] });
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.parse(JSON.stringify(bundle)), bundle);
    });
    test('supports registering new types and their reference validation', () => {
        ResourceBundle_1.ResourceTypes.register({
            type: 'test-animation', label: 'Test animation',
            create: (id, name) => ({ id, name, type: 'test-animation', frameId: 'sprite-1' }),
            getReferences: resource => [resource.frameId],
            validate: (resource, bundle) => bundle.resources.some(item => item.id === resource.frameId) ? [] : ['Missing frame.']
        });
        const { bundle, sprite } = createBundle();
        const animation = ResourceBundle_1.ResourceTypes.get('test-animation').create('animation-1', 'run');
        bundle.resources.push(animation);
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.getDependents(bundle, sprite.id), [animation]);
        animation.frameId = 'missing';
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /Missing frame/);
    });
    test('fails safely on corrupt JSON, shapes, and future schema versions', () => {
        for (const text of ['{', 'null', '[]', '{}', '{"schemaVersion":3}', '{"schemaVersion":1,"sourceFolders":[],"resources":[null]}']) {
            assert.throws(() => ResourceBundle_1.ResourceBundles.parse(text));
        }
    });
    test('uses only the clean sprite schema and rejects the old bundle version', () => {
        const { bundle, sprite } = createBundle();
        assert.strictEqual(bundle.schemaVersion, 2);
        assert.strictEqual(sprite.pivot, null);
        assert.strictEqual(sprite.flipX, undefined);
        assert.strictEqual(sprite.flags, undefined);
        assert.strictEqual(sprite.pivotPixels, undefined);
        assert.throws(() => ResourceBundle_1.ResourceBundles.parse(JSON.stringify({ ...bundle, schemaVersion: 1 })), /Expected 2/);
        delete sprite.colorMode;
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /color mode/);
    });
    test('RGB565 has no palette dependency and requires opaque blend', () => {
        const bundle = ResourceBundle_1.ResourceBundles.create();
        const sprite = ResourceBundle_1.ResourceTypes.get('sprite').create('rgb', 'rgb', 'hero.png', { colorMode: 'rgb565' });
        bundle.resources.push(sprite);
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        assert.deepStrictEqual(ResourceBundle_1.ResourceTypes.get('sprite').getReferences(sprite), []);
        assert.strictEqual(ResourceBundle_1.ResourceTypes.get('sprite').getPaletteSource(sprite), undefined);
        sprite.blend = 'alpha';
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /Opaque/);
    });
    test('validates sprite metadata, classification references and pixel pivots', () => {
        const { bundle, sprite } = createBundle();
        bundle.registries = { groups: ['props'], types: ['wood'], tags: ['breakable'] };
        Object.assign(sprite, { group: 'props', objectType: 'wood', tags: ['breakable'], pivot: { x: 10, y: 20.5 }, number: -32768, frameRate: 127 });
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        Object.assign(sprite, { group: 'missing', tags: ['missing'], number: 32768, frameRate: 0, pivot: { x: 0.1, y: 0 } });
        assert.strictEqual(ResourceBundle_1.ResourceBundles.validate(bundle).length, 5);
        bundle.registries.tags = Array(33).fill('tag');
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /32/);
    });
    test('reserves hidden modes without losing their metadata', () => {
        const { bundle, sprite } = createBundle();
        sprite.colorMode = 'rgb6666';
        sprite.blend = 'bump';
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.parse(JSON.stringify(bundle)), bundle);
        for (const blend of ['dudv', 'refl']) {
            sprite.blend = blend;
            assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        }
    });
    test('validates and derives names according to the specification', () => {
        assert.strictEqual(ResourceValidation.deriveName('My Hero-1.PNG'), 'my_hero_1');
        assert.strictEqual(ResourceValidation.deriveName('0.png'), '0_1');
        assert.strictEqual(ResourceValidation.deriveName('zero.png'), 'zero_1');
        assert.strictEqual(ResourceValidation.deriveName('!!!.png'), 'sprite');
        assert.strictEqual(ResourceValidation.deriveName('a'.repeat(40) + '.png').length, 23);
        assert.strictEqual(ResourceValidation.deriveName('hero.png', ['hero', 'hero_1']), 'hero_2');
        assert.strictEqual(ResourceValidation.paletteName('a'.repeat(23)).length, 23);
        for (const [name, code] of [['My Hero', 'V-001'], ['a'.repeat(24), 'V-002'], ['icon', 'V-003']]) {
            assert.match(ResourceValidation.name(name), new RegExp(code));
        }
        assert.match(ResourceValidation.name('hero', ['hero']), /V-004/);
        const { bundle, sprite } = createBundle();
        sprite.name = 'UpperCase';
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-001/);
    });
    test('enforces palette limits and prevents mixed alpha membership', () => {
        const { bundle, palette, sprite } = createBundle();
        for (const size of [2, 3, 15, 16, 32, 33, 64, 128, 255, 256]) {
            palette.colorCount = size;
            assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        }
        for (const size of [0, 1, 257, 32.5]) {
            palette.colorCount = size;
            assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-015/);
        }
        palette.colorCount = 256;
        const opaque = { ...sprite, id: 'opaque', name: 'opaque', blend: 'opaque' };
        bundle.resources.push(opaque);
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-017/);
        opaque.blend = 'additive';
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        bundle.resources = Array.from({ length: 65 }, (_, index) => ResourceBundle_1.ResourceTypes.get('palette').create('p' + index, 'p' + index));
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-016/);
        bundle.resources.pop();
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        assert.ok(ResourceBundle_1.ResourceBundles.getWarnings(bundle).some(message => message.includes('V-026')));
    });
    test('accepts fractional colliders and out-of-image pivots but rejects negative collider values', () => {
        const { bundle, sprite } = createBundle();
        sprite.collider = { enabled: true, x: 1.5, y: 2.25, width: 5.5, height: 8 };
        sprite.pivot = { x: -0.5, y: 1000 };
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        sprite.collider.x = -1.5;
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /nonnegative/);
        sprite.collider.x = 1.5;
        sprite.collider.width = Infinity;
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /finite/);
    });
    test('validates Softkey settings only for non-palettized sprites', () => {
        const bundle = ResourceBundle_1.ResourceBundles.create();
        const sprite = ResourceBundle_1.ResourceTypes.get('sprite').create('rgb', 'rgb', 'hero.png', { colorMode: 'rgb565' });
        bundle.resources.push(sprite);
        sprite.compression = 'softkey';
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-020/);
        sprite.softkey = { key: '#ff00ff', threshold: 0 };
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        sprite.softkey.threshold = 256;
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-020/);
        sprite.softkey = { key: '#ff00ff80', threshold: 0 };
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-020/);
        sprite.softkey = { key: '#ff00ff', threshold: 255 };
        assert.deepStrictEqual(ResourceBundle_1.ResourceBundles.validate(bundle), []);
        sprite.compression = 'plain';
        assert.match(ResourceBundle_1.ResourceBundles.validate(bundle).join(' '), /V-020/);
    });
});
//# sourceMappingURL=resourceBundle.test.js.map