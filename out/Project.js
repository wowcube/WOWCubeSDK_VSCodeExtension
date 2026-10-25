"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const fs = require("fs");
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
    static getAdhocDescription(workspace) {
        var s = "No description";
        try {
            var json = JSON.parse(fs.readFileSync(workspace + '/wowcubeapp-build.json', 'utf-8'));
            if (typeof json.adhocDescription != 'undefined') {
                s = json.adhocDescription;
            }
        }
        catch (e) { }
        Project.AdHocDescription = s;
        return s;
    }
    static setAdhocDescription(workspace, s) {
        var res = true;
        try {
            if (s.length == 0)
                s = "No description";
            if (s.length > 8192) {
                s = s.substring(0, 8188);
                s += '...';
            }
            ;
            Project.AdHocDescription = s;
            var json = JSON.parse(fs.readFileSync(workspace + '/wowcubeapp-build.json', 'utf-8'));
            json.adhocDescription = s;
            var str = JSON.stringify(json);
            fs.writeFileSync(workspace + '/wowcubeapp-build.json', str);
        }
        catch (e) {
            res = false;
        }
        return res;
    }
    static validateAssets(workspace, autosave) {
        try {
            //load current project file
            var json = JSON.parse(fs.readFileSync(workspace + '/wowcubeapp-build.json', 'utf-8'));
            //check icon 
            /*
            if(typeof json.appIcon!=='undefined' && typeof json.appIcon.path==='undefined')
            {
                //old project format?

                var v = json.appIcon;
                json.appIcon = {path:v, encoding:'ARGB6666'};
            }
            */
            //check app flags 
            if (typeof json.appFlags === 'undefined') {
                json.appFlags = '0';
            }
            //check language
            if (typeof json.language === 'undefined') {
                Project.CurrentLanguage = "c";
            }
            else {
                Project.CurrentLanguage = json.language;
            }
            var v = json.appFlags;
            if (typeof (v) === 'string' || v instanceof String) {
                //New format of project file requres appFlags to be an integer.
                json.appFlags = parseInt(json.appFlags);
            }
            //check language-related settings
            if (typeof (json.language) === 'undefined') {
                json.language = 'c';
            }
            //check options
            /*
            "projectOptions": {
                "cpp": {
                "defines": "",
                "flags": "-std=c++11 -g0 -O3",
                "includeFolders": []
                }
            }
            */
            if (json.interpreter === 'wasm' && json.language === 'cpp') {
                if (typeof (json.projectOptions) === 'undefined') {
                    json.projectOptions = new Object();
                }
                /*
                if(typeof(json.projectOptions.cpp) === 'undefined')
                {
                    json.projectOptions.cpp = new Object();
                    json.projectOptions.cpp.defines = "";
                    json.projectOptions.cpp.flags = "-std=c++11 -Oz -flto -fno-exceptions -mexec-model=reactor -z stack-size=10240";
                    json.projectOptions.cpp.compilerSettings = ",--initial-memory=65536,--export=run,--export=on_init,--strip-all,--lto-O3";
                    json.projectOptions.cpp.includeFolders = new Array();
                    json.projectOptions.cpp.includeFolders.push("");
                    json.projectOptions.cpp.includeFolders.push("");
                    json.projectOptions.cpp.includeFolders.push("");
                    json.projectOptions.cpp.includeFolders.push("");
                    json.projectOptions.cpp.includeFolders.push("");
                }

                for(var i=0;i<5;i++)
                {
                    if(typeof(json.projectOptions.cpp.includeFolders[i])=='undefined')
                    {
                        json.projectOptions.cpp.includeFolders.push("");
                        i--;
                    }
                }
                */
            }
            Project.Options = json.projectOptions;
            //get and validate ad-hoc description
            json.adhocDescription = Project.getAdhocDescription(workspace);
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
Project.Options = null;
Project.AdHocDescription = 'No description';
//# sourceMappingURL=Project.js.map