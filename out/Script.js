"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Script = void 0;
const fs = require("fs");
class Script {
    static load(filename) {
        var ret = true;
        try {
            if (Script.filename.length == 0) {
                Script.filename = filename;
                Script.content = fs.readFileSync(Script.filename, 'utf-8');
            }
            else {
                ret = false;
            }
        }
        catch (e) {
            ret = false;
        }
        return ret;
    }
    static save() {
        var ret = true;
        try {
            if (Script.filename.length != 0) {
                fs.writeFileSync(Script.filename, Script.content);
                Script.filename = "";
            }
            else {
                ret = false;
            }
        }
        catch (e) {
            ret = false;
        }
        return ret;
    }
    static setValue(key, val) {
        var ret = true;
        try {
            if (Script.filename.length > 0) {
                Script.content = Script.content.replace(key, val);
            }
        }
        catch (e) {
            ret = false;
        }
        return ret;
    }
    static setTOMLValue(key, val) {
        var ret = true;
        try {
            if (key.length > 0) {
                let fullKey = key + ' = ';
                var key_index = Script.content.indexOf(fullKey);
                if (key_index != -1) {
                    var lf_index = Script.content.indexOf("\n", key_index + fullKey.length);
                    var lpart = Script.content.substring(0, key_index + fullKey.length);
                    var rpart = Script.content.substring(lf_index);
                    Script.content = lpart + '"' + val + '"' + rpart;
                }
            }
            else {
                ret = false;
            }
        }
        catch (e) {
            ret = false;
        }
        return ret;
    }
}
exports.Script = Script;
Script.content = "";
Script.filename = "";
//# sourceMappingURL=Script.js.map