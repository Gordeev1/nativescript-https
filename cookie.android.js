"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function resolveCookieString(headers) {
    var searchReg = /^set-cookie$/i;
    var length = headers.size();
    var result = [];
    for (var i = 0; i < length; i++) {
        var key = headers.name(i);
        if (key.match(searchReg)) {
            var value = headers.value(i);
            result = result.concat([value]);
        }
    }
    return result;
}
exports.resolveCookieString = resolveCookieString;
//# sourceMappingURL=cookie.android.js.map