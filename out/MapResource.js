"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapResourceType = void 0;
const ResourceBundle_1 = require("./ResourceBundle");
const mapgeometry_1 = require("../media/mapgeometry");
exports.mapResourceType = {
    type: 'map', label: 'Map',
    create: (id, name) => ({ id, name, type: 'map', placements: [],
        net: { ...(0, mapgeometry_1.computeNetLayout)().params, backgroundImage: null },
        sideMarkers: Array.from({ length: 6 }, (_, side) => ({ name: '~side' + side, side, x: 0, y: 0 })) }),
    getReferences: resource => Array.isArray(resource.placements) ? [...new Set(resource.placements.map(item => item.spriteId))] : [],
    validate: (resource, bundle) => {
        const map = resource;
        const errors = [];
        if (!map.net || typeof map.net !== 'object' || Array.isArray(map.net)) {
            errors.push('Map net settings are required.');
        }
        else {
            if (['screenSize', 'innerGap', 'faceEdgeGap', 'frame', 'padding'].some(key => map.net[key] === undefined)) {
                errors.push('Map geometry settings must be explicit.');
            }
            try {
                (0, mapgeometry_1.computeNetLayout)(map.net);
            }
            catch (error) {
                errors.push(error.message);
            }
            for (const key of ['lineColor', 'markerColor', 'background']) {
                if (key === 'background' && map.net.background === null) {
                    continue;
                }
                if (typeof map.net[key] !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(map.net[key])) {
                    errors.push('Map ' + key + ' must be a hex RGB/RGBA color.');
                }
            }
            if (typeof map.net.markers !== 'boolean') {
                errors.push('Map marker visibility must be a boolean.');
            }
            if (map.net.backgroundImage !== null && (!(0, ResourceBundle_1.isResourcePath)(map.net.backgroundImage) || !/\.(png|jpe?g|gif|webp|bmp)$/i.test(map.net.backgroundImage))) {
                errors.push('Map background image must be a project-relative image path or null.');
            }
        }
        if (!Array.isArray(map.placements)) {
            errors.push('Map placements must be an ordered array.');
        }
        else {
            const ids = new Set();
            for (const item of map.placements) {
                if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id)) {
                    errors.push('Map placement IDs must be nonempty and unique within the map.');
                    continue;
                }
                ids.add(item.id);
                if (item.twistable !== undefined && typeof item.twistable !== 'boolean') {
                    errors.push('Map placement Twistable must be a boolean.');
                }
                if (!bundle.resources.some(sprite => sprite.type === 'sprite' && sprite.id === item.spriteId)) {
                    errors.push('Map placement must reference an existing sprite.');
                }
                if (!Number.isInteger(item.side) || item.side < 0 || item.side > 5 || !Number.isFinite(item.x) || !Number.isFinite(item.y)) {
                    errors.push('Map placements require a side from 0 to 5 and finite face coordinates.');
                }
            }
        }
        if (!Array.isArray(map.sideMarkers) || map.sideMarkers.length !== 6 || new Set(map.sideMarkers.map(item => item?.side)).size !== 6 ||
            map.sideMarkers.some(item => !item || !Number.isInteger(item.side) || item.side < 0 || item.side > 5 || item.name !== '~side' + item.side || item.x !== 0 || item.y !== 0)) {
            errors.push('Maps require six face-center markers named ~side0 through ~side5 at face coordinates (0, 0).');
        }
        return errors;
    }
};
//# sourceMappingURL=MapResource.js.map