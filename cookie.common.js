"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var platform_1 = require("tns-core-modules/platform");
var AppSettings = require("tns-core-modules/application-settings");
var MobileStorageCookieStore = require('tough-cookie-mobile-storage-store');
var tough_cookie_no_native_1 = require("tough-cookie-no-native");
var cookie_ios_1 = require("./cookie.ios");
var cookie_android_1 = require("./cookie.android");
var STORE_KEY = 'NS_COOKIE_STORE';
var NSStorageWrapper = (function () {
    function NSStorageWrapper() {
        this.getItem = function (key) { return AppSettings.getString(key); };
        this.setItem = function (key, value) { return AppSettings.setString(key, value); };
    }
    return NSStorageWrapper;
}());
var store = new MobileStorageCookieStore(new NSStorageWrapper(), STORE_KEY);
exports.cookieJar = new tough_cookie_no_native_1.CookieJar(store);
function handleCookie(url, headers) {
    var cookies = platform_1.isAndroid
        ? cookie_android_1.resolveCookieString(headers)
        : cookie_ios_1.resolveCookieString(headers);
    console.log('received cookie');
    try {
        console.dir(JSON.stringify(cookies));
    }
    catch (error) {
        console.log(error.message);
    }
    return (cookies &&
        cookies.length &&
        cookies.forEach(function (cookie) { return exports.cookieJar.setCookieSync(cookie, url, { ignoreError: true }); }));
}
exports.handleCookie = handleCookie;
function resolvePassedCookieString(headers) {
    if (headers === void 0) { headers = {}; }
    var searchReg = /^cookie$/i;
    var key = Object.keys(headers).find(function (key) { return Boolean(key.match(searchReg)); });
    var cookie = headers[key];
    return Array.isArray(cookie) ? cookie.reduce(function (s1, s2) { return s1 + "; " + s2; }, '') : cookie;
}
function mergeRequestHeaders(url, headers) {
    if (headers === void 0) { headers = {}; }
    var cookies = resolvePassedCookieString(headers);
    var existingCookies = exports.cookieJar.getCookieStringSync(url);
    console.log('existing cookie');
    try {
        console.dir(JSON.stringify(existingCookies));
    }
    catch (error) {
        console.log(error.message);
    }
    var mergedCookies = [cookies, existingCookies]
        .filter(function (str) { return str; })
        .reduce(function (s1, s2) { return s1 + "; " + s2; }, '');
    return mergedCookies ? __assign({}, headers, { Cookie: mergedCookies }) : headers;
}
exports.mergeRequestHeaders = mergeRequestHeaders;
function clearCookies() {
    return AppSettings.remove(STORE_KEY);
}
exports.clearCookies = clearCookies;
//# sourceMappingURL=cookie.common.js.map