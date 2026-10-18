"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteSequences = void 0;
const crypto = require("crypto");
const ResourceBundle_1 = require("./ResourceBundle");
const ResourceValidation = require("../media/resourcevalidation");
class SpriteSequences {
    static frames(bundle, id) {
        if (!id) {
            return [];
        }
        return bundle.resources.filter(resource => resource.type === 'sprite' && resource.sequence?.id === id)
            .sort((a, b) => a.sequence.index - b.sequence.index);
    }
    static validate(bundle) {
        const errors = [], groups = new Map();
        for (const resource of bundle.resources) {
            if (resource.type !== 'sprite' || resource.sequence === undefined) {
                continue;
            }
            const sprite = resource, sequence = sprite.sequence;
            if (!sequence || typeof sequence.id !== 'string' || !sequence.id || ResourceValidation.name(sequence.name) || !Number.isInteger(sequence.index) || sequence.index < 0) {
                errors.push(resource.name + ': Invalid sequence membership.');
                continue;
            }
            const frames = groups.get(sequence.id) || [];
            frames.push(sprite);
            groups.set(sequence.id, frames);
        }
        const names = new Set(bundle.resources.map(resource => resource.name));
        for (const frames of groups.values()) {
            frames.sort((a, b) => a.sequence.index - b.sequence.index);
            const name = frames[0].sequence.name;
            if (names.has(name)) {
                errors.push('Sequence names must be unique across sequences and resources: ' + name);
            }
            names.add(name);
            if (frames.some(frame => frame.sequence.name !== name)) {
                errors.push('Some frames in animation "' + name + '" use a different animation name. All frames must belong to the same animation.');
            }
            if (frames.some((frame, index) => frame.sequence.index !== index)) {
                errors.push('Animation "' + name + '" has an invalid frame order. To delete frames, use "Remove selected frame" in the Animations tab so the remaining frames are reordered automatically.');
            }
        }
        return errors;
    }
    static aliasErrors(bundle) {
        const errors = [], seen = new Set();
        for (const sprite of bundle.resources) {
            if (sprite.type !== 'sprite' || !sprite.sequence || seen.has(sprite.sequence.id)) {
                continue;
            }
            seen.add(sprite.sequence.id);
            const error = ResourceValidation.animationName(sprite.sequence.name, ResourceValidation.usedNames(bundle.resources, undefined, sprite.sequence.id));
            if (error) {
                errors.push(error);
            }
        }
        return errors;
    }
    static buildErrors(bundle) {
        const errors = this.aliasErrors(bundle), seen = new Set();
        for (const sprite of bundle.resources) {
            if (sprite.type !== 'sprite' || !sprite.sequence || seen.has(sprite.sequence.id)) {
                continue;
            }
            seen.add(sprite.sequence.id);
            if (this.frames(bundle, sprite.sequence.id).length < 2) {
                errors.push('Animation "' + sprite.sequence.name + '" needs at least two frames before it can be built. Add another frame in the Animations tab, or remove the animation.');
            }
        }
        return errors;
    }
    static usedNames(bundle) {
        return ResourceValidation.usedNames(bundle.resources);
    }
    static createFrames(bundle, name, sources, rate, sequenceId) {
        const id = sequenceId || crypto.randomBytes(16).toString('hex');
        const offset = this.frames(bundle, id).length, used = [...this.usedNames(bundle), name, name + '_end'];
        return sources.map((source, index) => {
            const frameName = ResourceValidation.deriveName(name.slice(0, 17) + '_' + String(offset + index).padStart(3, '0'), used);
            used.push(frameName);
            const frame = ResourceBundle_1.ResourceTypes.get('sprite').create(crypto.randomBytes(16).toString('hex'), frameName, source.source);
            frame.sequence = { id, name, index: offset + index };
            frame.frameRate = rate;
            frame.pivot = { x: source.width / 2, y: source.height / 2 };
            return frame;
        });
    }
}
exports.SpriteSequences = SpriteSequences;
//# sourceMappingURL=SpriteSequence.js.map