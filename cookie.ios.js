"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function resolveCookieString(headers) {
    var searchReg = /^set-cookie$/i;
    var result = [];
    headers.enumerateKeysAndObjectsUsingBlock(function (key, value) {
        if (key.match(searchReg)) {
            result = result.concat([value]);
        }
    });
    return result;
}
exports.resolveCookieString = resolveCookieString;
//# sourceMappingURL=cookie.ios.js.map