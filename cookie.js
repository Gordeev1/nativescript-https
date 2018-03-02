"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AppSettings = require("tns-core-modules/application-settings");
var MobileStorageCookieStore = require('tough-cookie-mobile-storage-store');
var tough_cookie_no_native_1 = require("tough-cookie-no-native");
var STORE_KEY = 'NS_COOKIE_STORE';
var NSStorageWrapper = (function () {
    function NSStorageWrapper() {
        this.getItem = function (key) { return AppSettings.getString(key); };
        this.setItem = function (key, value) { return AppSettings.setString(key, value); };
    }
    return NSStorageWrapper;
}());
var store = new MobileStorageCookieStore(new NSStorageWrapper(), STORE_KEY);
var cookieJar = new tough_cookie_no_native_1.CookieJar(store);
function resolveCookieString(headers, _a) {
    if (headers === void 0) { headers = {}; }
    var existing = (_a === void 0 ? {} : _a).existing;
    var searchReg = existing ? /^cookie$/i : /^set-cookie$/i;
    var key = Object.keys(headers).find(function (key) { return Boolean(key.match(searchReg)); });
    var cookie = headers[key];
    return Array.isArray(cookie) ? cookie.reduce(function (s1, s2) { return s1 + "," + s2; }, '') : cookie;
}
function handleCookie(url, headers) {
    var cookies = resolveCookieString(headers);
    console.log('received cookie');
    try {
        console.dir(JSON.stringify(cookies));
    }
    catch (error) {
        console.log(error.message);
    }
    cookies &&
        cookies
            .split(',')
            .map(function (cookie) { return cookie.trim(); })
            .forEach(function (cookie) { return cookieJar.setCookieSync(cookie, url, { ignoreError: true }); });
}
exports.handleCookie = handleCookie;
function mergeRequestHeaders(url, headers) {
    if (headers === void 0) { headers = {}; }
    var cookies = resolveCookieString(headers, { existing: true });
    var existingCookies = cookieJar.getCookieStringSync(url);
    console.log('existing cookie');
    try {
        console.dir(JSON.stringify(existingCookies));
    }
    catch (error) {
        console.log(error.message);
    }
    var mergedCookie = [cookies, existingCookies]
        .filter(function (str) { return str; })
        .reduce(function (s1, s2) { return s1 + s2; }, '');
    return mergedCookie ? __assign({}, headers, { Cookie: mergedCookie }) : headers;
}
exports.mergeRequestHeaders = mergeRequestHeaders;
function clearCookies() {
    return AppSettings.remove(STORE_KEY);
}
exports.clearCookies = clearCookies;
//# sourceMappingURL=cookie.js.map