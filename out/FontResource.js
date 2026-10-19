"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fontResourceType = void 0;
const ResourceBundle_1 = require("./ResourceBundle");
exports.fontResourceType = {
    type: 'font', label: 'Font', getPaletteSource: resource => resource.atlas,
    create: (id, name, source = '', options = {}) => ({ id, name, type: 'font', source, atlas: options.atlas || '', slot: options.slot ?? 1, paletteId: options.paletteId || '', fullsize: true, blend: 'alpha' }),
    validate: (resource, bundle) => {
        const errors = [];
        if (!(0, ResourceBundle_1.isResourcePath)(resource.source) || !/\.fnt$/i.test(resource.source)) {
            errors.push('Choose a project-relative .fnt source file.');
        }
        if (!(0, ResourceBundle_1.isResourcePath)(resource.atlas) || !/\.png$/i.test(resource.atlas)) {
            errors.push('Choose a project-relative PNG atlas.');
        }
        if (!Number.isInteger(resource.slot) || ![1, 2, 3].includes(resource.slot)) {
            errors.push('Font slot must be 1, 2 or 3.');
        }
        if (bundle.resources.some(item => item !== resource && item.id !== resource.id && item.type === 'font' && item.slot === resource.slot)) {
            errors.push('Font slot ' + resource.slot + ' is already occupied. Choose another slot.');
        }
        if (!bundle.resources.some(item => item.type === 'palette' && item.id === resource.paletteId)) {
            errors.push('Choose an alpha palette for this font.');
        }
        if (typeof resource.fullsize !== 'boolean' || resource.blend !== 'alpha') {
            errors.push('Fonts require an alpha blend and a boolean FULLSIZE setting.');
        }
        return errors;
    },
    getReferences: resource => [resource.paletteId]
};
//# sourceMappingURL=FontResource.js.map