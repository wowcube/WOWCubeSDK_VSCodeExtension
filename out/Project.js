"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const fs = require("fs");
const Asset_1 = require("./Asset");
class Project {
    //sets SDK version to currently opened project file
    static setSDKVersion(workspace, version) {
        try {
            if (/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(version)) {
                var json = JSON.parse(fs.readFileSync(workspace + '/wowcubeapp-build.json', 'utf-8'));
                json.sdkVersion = version;
                var str = JSON.stringify(json);
                fs.writeFileSync(workspace + '/wowcubeapp-build.json', str);
                return true;
            }
        }
        catch (e) { }
        return false;
    }
    static validateAssets(workspace, autosave) {
        try {
            //load current project file
            var json = JSON.parse(fs.readFileSync(workspace + '/wowcubeapp-build.json', 'utf-8'));
            //check icon 
            if (typeof json.appIcon !== 'undefined' && typeof json.appIcon.path === 'undefined') {
                //old project format? 
                var v = json.appIcon;
                json.appIcon = { path: v, encoding: 'ARGB6666' };
            }
            //check app flags
            if (typeof json.appFlags === 'undefined') {
                json.appFlags = '0';
            }
            //check language
            if (typeof json.language === 'undefined') {
                Project.CurrentLanguage = "pawn";
            }
            else {
                Project.CurrentLanguage = json.language;
            }
            //fetch images
            var imagedir = workspace + '/assets/images';
            var sounddir = workspace + '/assets/sounds';
            this.Images = new Array();
            this.Sounds = new Array();
            if (fs.existsSync(imagedir) === true) {
                fs.readdirSync(imagedir).forEach(file => {
                    var asset = new Asset_1.Asset();
                    if (file !== '.DS_Store') {
                        asset.path = 'assets/images/' + file;
                        asset.alias = file.substring(0, 15);
                        this.Images.push(asset);
                    }
                });
            }
            //fetch sounds
            if (fs.existsSync(sounddir) === true) {
                fs.readdirSync(sounddir).forEach(file => {
                    var asset = new Asset_1.Asset();
                    if (file !== '.DS_Store') {
                        asset.path = 'assets/sounds/' + file;
                        asset.alias = file.substring(0, 15);
                        this.Sounds.push(asset);
                    }
                });
            }
            //now see what's in the json and fix any missing files
            var found = false;
            try {
                var imageAssets = json.imageAssets;
                if (typeof imageAssets !== 'undefined') {
                    found = true;
                }
            }
            catch (e) { }
            if (!found) {
                json.imageAssets = new Array();
            }
            var missingAssets = new Array();
            for (var j = 0; j < this.Images.length; j++) {
                var b = this.Images[j];
                var found = false;
                for (var i = 0; i < json.imageAssets.length; i++) {
                    var a = json.imageAssets[i];
                    if (a.path === b.path) {
                        found = true;
                        if (typeof a.alias === 'undefined') {
                            json.imageAssets[i].alias = b.alias;
                        }
                        break;
                    }
                }
                if (!found) {
                    missingAssets.push(b);
                }
            }
            if (missingAssets.length > 0) {
                missingAssets.forEach(asset => {
                    json.imageAssets.push({ path: asset.path, alias: asset.alias });
                });
            }
            for (var i = 0; i < json.imageAssets.length; i++) {
                var found = false;
                for (var j = 0; j < this.Images.length; j++) {
                    if (json.imageAssets[i].path === this.Images[j].path) {
                        found = true;
                        break;
                    }
                }
                if (found === false) {
                    json.imageAssets.splice(i, 1);
                    i--;
                }
            }
            found = false;
            try {
                var soundAssets = json.soundAssets;
                if (typeof soundAssets !== 'undefined') {
                    found = true;
                }
            }
            catch (e) { }
            if (!found) {
                json.soundAssets = new Array();
            }
            missingAssets = new Array();
            for (var j = 0; j < this.Sounds.length; j++) {
                var b = this.Sounds[j];
                var found = false;
                for (var i = 0; i < json.soundAssets.length; i++) {
                    var a = json.soundAssets[i];
                    if (a.path === b.path) {
                        found = true;
                        if (typeof a.alias === 'undefined') {
                            json.imageAssets[i].alias = b.alias;
                        }
                        break;
                    }
                }
                if (!found) {
                    missingAssets.push(b);
                }
            }
            if (missingAssets.length > 0) {
                missingAssets.forEach(asset => {
                    json.soundAssets.push({ path: asset.path, alias: asset.alias });
                });
            }
            for (var i = 0; i < json.soundAssets.length; i++) {
                var found = false;
                for (var j = 0; j < this.Sounds.length; j++) {
                    if (json.soundAssets[i].path === this.Sounds[j].path) {
                        found = true;
                        break;
                    }
                }
                if (found === false) {
                    json.soundAssets.splice(i, 1);
                    i--;
                }
            }
            var v = json.appFlags;
            if (typeof (v) === 'string' || v instanceof String) {
                //New format of project file requres appFlags to be an integer.
                json.appFlags = parseInt(json.appFlags);
            }
            //check language-related settings
            if (typeof (json.language) === 'undefined') {
                json.language = 'pawn';
            }
            if (typeof (json.interpreter) === 'undefined') {
                json.interpreter = 'pawn';
            }
            //save changes
            var str = JSON.stringify(json, null, 2);
            if (autosave === true) {
                fs.writeFileSync(workspace + '/wowcubeapp-build.json', str);
            }
            Project.Json = json;
            return true;
        }
        catch (e) { }
        return false;
    }
}
exports.Project = Project;
Project.Images = new Array();
Project.Sounds = new Array();
Project.CurrentLanguage = 'pawn';
//# sourceMappingURL=Project.js.map