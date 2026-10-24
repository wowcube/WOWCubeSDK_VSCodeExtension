"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.soundResourceType = void 0;
exports.soundResourceType = {
    type: 'sound', label: 'Sound',
    create: (id, name, source = '') => ({ id, name, type: 'sound', source }),
    validate: resource => typeof resource.source === 'string' ? [] : ['A sound source must be a string.'],
    getReferences: () => []
};
//# sourceMappingURL=SoundResource.js.map