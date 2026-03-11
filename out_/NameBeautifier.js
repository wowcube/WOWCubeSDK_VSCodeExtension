"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NameBeautifier = void 0;
class NameBeautifier {
    static rustClassName(name) {
        var str = name;
        var desc = "";
        const keywords = [
            'as',
            'break',
            'const',
            'continue',
            'crate',
            'else',
            'enum',
            'extern',
            'false',
            'fn',
            'for',
            'if',
            'impl',
            'in',
            'let',
            'loop',
            'match',
            'mod',
            'move',
            'mut',
            'pub',
            'ref',
            'return',
            'self',
            'Self',
            'static',
            'struct',
            'super',
            'trait',
            'true',
            'type',
            'unsafe',
            'use',
            'where',
            'while',
            'abstract',
            'become',
            'box',
            'do',
            'final',
            'macro',
            'override',
            'priv',
            'typeof',
            'unsized',
            'virtual',
            'yield',
            'try'
        ];
        const digitReplace = "Replacing a digit at the beginning of the name with textual represenation, class name can only start with a non-digit.";
        try {
            if (str.length == 0) {
                throw new Error("Incorrect length of the name");
            }
            //check if first character in the name is not a digit
            if (str[0] == '0') {
                str = str.replace('0', 'Zero');
                desc = digitReplace;
            }
            if (str[0] == '1') {
                str = str.replace('1', 'One');
                desc = digitReplace;
            }
            if (str[0] == '2') {
                str = str.replace('2', 'Two');
                desc = digitReplace;
            }
            if (str[0] == '3') {
                str = str.replace('3', 'Three');
                desc = digitReplace;
            }
            if (str[0] == '4') {
                str = str.replace('4', 'Four');
                desc = digitReplace;
            }
            if (str[0] == '5') {
                str = str.replace('5', 'Five');
                desc = digitReplace;
            }
            if (str[0] == '6') {
                str = str.replace('6', 'Six');
                desc = digitReplace;
            }
            if (str[0] == '7') {
                str = str.replace('7', 'Seven');
                desc = digitReplace;
            }
            if (str[0] == '8') {
                str = str.replace('8', 'Eight');
                desc = digitReplace;
            }
            if (str[0] == '9') {
                str = str.replace('9', 'Nine');
                desc = digitReplace;
            }
            //check for ASCII-only symbols
            var str2 = str.replace(/[^A-Za-z0-9]/g, '_');
            if (str != str2) {
                desc += "Replacing all non-ASCII characters with an underscore, class name can only have a subset of ASCII characters.";
                str = str2;
            }
            //check if the name isn't entirely out of underscores
            var found = false;
            for (var i = 0; i < str.length; i++) {
                if (str[i] !== '_') {
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw new Error("Class name doesn't contain any characters, defaulting...");
            }
            //check if name is a reserved keyword
            for (var i = 0; i < keywords.length; i++) {
                if (str == keywords[i]) {
                    desc += "Surrounding the name with underscores, class name can not be one of the reserved keywords.";
                    str = '_' + keywords[i] + '_';
                    break;
                }
            }
        }
        catch (e) {
            return { str: "MyClassName", err: 1, desc: e };
        }
        return { str: str, err: 0, desc: desc };
    }
    static cppClassName(name) {
        var str = name;
        var desc = "";
        const keywords = [
            'alignas',
            'alignof',
            'and',
            'and_eq',
            'asm',
            'atomic_cancel',
            'atomic_commit',
            'atomic_noexcept',
            'auto',
            'bitand',
            'bitor',
            'bool',
            'break',
            'case',
            'catch',
            'char',
            'char8_t',
            'char16_t',
            'char32_t',
            'class',
            'compl',
            'concept',
            'const',
            'consteval',
            'constexpr',
            'constinit',
            'const_cast',
            'continue',
            'co_await',
            'co_return',
            'co_yield',
            'decltype',
            'default',
            'delete',
            'do',
            'double',
            'dynamic_cast',
            'else',
            'enum',
            'explicit',
            'export',
            'extern',
            'false',
            'float',
            'for',
            'friend',
            'goto',
            'if',
            'inline',
            'int',
            'long',
            'mutable',
            'namespace',
            'new',
            'noexcept',
            'not',
            'not_eq',
            'nullptr',
            'operator',
            'or',
            'or_eq',
            'private',
            'protected',
            'public',
            'reflexpr',
            'register',
            'reinterpret_cast',
            'requires',
            'return',
            'short',
            'signed',
            'sizeof',
            'static',
            'static_assert',
            'static_cast',
            'struct',
            'switch',
            'synchronized',
            'template',
            'this',
            'thread_local',
            'throw',
            'true',
            'try',
            'typedef',
            'typeid',
            'typename',
            'union',
            'unsigned',
            'using',
            'virtual',
            'void',
            'volatile',
            'wchar_t',
            'while',
            'xor',
            'xor_eq',
            'final',
            'override',
            'transaction_safe',
            'transaction_safe_dynamic',
            'if',
            'elif',
            'else',
            'endif',
            'ifdef',
            'ifndef',
            'elifdef',
            'elifndef',
            'define',
            'undef',
            'include',
            'line',
            'error',
            'warning',
            'pragma',
            'defined',
            '__has_include',
            '__has_cpp_attribute',
            'export',
            'import',
            'module',
            '_Pragma'
        ];
        const digitReplace = "Replacing a digit at the beginning of the name with textual represenation, class name can only start with a non-digit.";
        try {
            if (str.length == 0) {
                throw new Error("Incorrect length of the name");
            }
            //check if first character in the name is not a digit
            if (str[0] == '0') {
                str = str.replace('0', 'Zero');
                desc = digitReplace;
            }
            if (str[0] == '1') {
                str = str.replace('1', 'One');
                desc = digitReplace;
            }
            if (str[0] == '2') {
                str = str.replace('2', 'Two');
                desc = digitReplace;
            }
            if (str[0] == '3') {
                str = str.replace('3', 'Three');
                desc = digitReplace;
            }
            if (str[0] == '4') {
                str = str.replace('4', 'Four');
                desc = digitReplace;
            }
            if (str[0] == '5') {
                str = str.replace('5', 'Five');
                desc = digitReplace;
            }
            if (str[0] == '6') {
                str = str.replace('6', 'Six');
                desc = digitReplace;
            }
            if (str[0] == '7') {
                str = str.replace('7', 'Seven');
                desc = digitReplace;
            }
            if (str[0] == '8') {
                str = str.replace('8', 'Eight');
                desc = digitReplace;
            }
            if (str[0] == '9') {
                str = str.replace('9', 'Nine');
                desc = digitReplace;
            }
            //check for ASCII-only symbols
            var str2 = str.replace(/[^A-Za-z0-9]/g, '_');
            if (str != str2) {
                desc += "Replacing all non-ASCII characters with an underscore, class name can only have a subset of ASCII characters.";
                str = str2;
            }
            //check if the name isn't entirely out of underscores
            var found = false;
            for (var i = 0; i < str.length; i++) {
                if (str[i] !== '_') {
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw new Error("Class name doesn't contain any characters, defaulting...");
            }
            //check if name is a reserved keyword
            for (var i = 0; i < keywords.length; i++) {
                if (str == keywords[i]) {
                    desc += "Surrounding the name with underscores, class name can not be one of the reserved keywords.";
                    str = '_' + keywords[i] + '_';
                    break;
                }
            }
        }
        catch (e) {
            return { str: "MyClassName", err: 1, desc: e };
        }
        return { str: str, err: 0, desc: desc };
    }
}
exports.NameBeautifier = NameBeautifier;
//# sourceMappingURL=NameBeautifier.js.map