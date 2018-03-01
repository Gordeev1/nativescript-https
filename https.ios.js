"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("tns-core-modules/utils/types");
var cookie_1 = require("./cookie");
var methods = {
    GET: 'GETParametersSuccessFailure',
    POST: 'POSTParametersSuccessFailure',
    PUT: 'PUTParametersSuccessFailure',
    DELETE: 'DELETEParametersSuccessFailure',
    PATCH: 'PATCHParametersSuccessFailure',
    HEAD: 'HEADParametersSuccessFailure'
};
var followRedirects = true;
var policies = {
    def: AFSecurityPolicy.defaultPolicy(),
    secured: false
};
policies.def.allowInvalidCertificates = true;
policies.def.validatesDomainName = false;
function enableSSLPinning(options) {
    if (!policies.secure) {
        policies.secure = AFSecurityPolicy.policyWithPinningMode(1);
        var allowInvalidCertificates = types_1.isDefined(options.allowInvalidCertificates)
            ? options.allowInvalidCertificates
            : false;
        policies.secure.allowInvalidCertificates = allowInvalidCertificates;
        var validatesDomainName = types_1.isDefined(options.validatesDomainName)
            ? options.validatesDomainName
            : true;
        policies.secure.validatesDomainName = validatesDomainName;
        var data = NSData.dataWithContentsOfFile(options.certificate);
        policies.secure.pinnedCertificates = NSSet.setWithObject(data);
    }
    policies.secured = true;
    console.log('nativescript-https > Enabled SSL pinning');
}
exports.enableSSLPinning = enableSSLPinning;
function disableSSLPinning() {
    policies.secured = false;
    console.log('nativescript-https > Disabled SSL pinning');
}
exports.disableSSLPinning = disableSSLPinning;
console.info('nativescript-https > Disabled SSL pinning by default');
function setupRedirects(follow) {
    followRedirects = follow;
    console.log('nativescript-https > Enable redirects');
}
exports.setupRedirects = setupRedirects;
function AFSuccess(task, data) {
    var content;
    if (data && data.class) {
        var name = data.class().name;
        if (data.enumerateKeysAndObjectsUsingBlock || name == 'NSArray') {
            var serial = NSJSONSerialization.dataWithJSONObjectOptionsError(data, 1);
            content = NSString.alloc()
                .initWithDataEncoding(serial, NSUTF8StringEncoding)
                .toString();
        }
        if (name == 'NSData') {
            content = NSString.alloc()
                .initWithDataEncoding(data, NSASCIIStringEncoding)
                .toString();
        }
        else {
            content = data;
        }
        try {
            content = JSON.parse(content);
        }
        catch (e) { }
    }
    else {
        content = data;
    }
    return Promise.resolve({ task: task, content: content });
}
function AFFailure(task, _a) {
    var description = _a.description, localizedDescription = _a.localizedDescription, userInfo = _a.userInfo;
    var data = userInfo.valueForKey(AFNetworkingOperationFailingURLResponseDataErrorKey);
    var body = NSString.alloc()
        .initWithDataEncoding(data, NSUTF8StringEncoding)
        .toString();
    try {
        body = JSON.parse(body);
    }
    catch (e) { }
    var content = {
        body: body,
        description: description,
        reason: localizedDescription,
        url: userInfo.objectForKey('NSErrorFailingURLKey').description
    };
    if (policies.secured == true) {
        content.description =
            'nativescript-https > Invalid SSL certificate! ' + content.description;
    }
    return Promise.resolve({ task: task, content: content, reason: localizedDescription });
}
function request(_a) {
    var headers = _a.headers, body = _a.body, url = _a.url, method = _a.method;
    return new Promise(function (resolve, reject) {
        try {
            var manager_1 = AFHTTPSessionManager.manager();
            if (headers && headers['Content-Type'] == 'application/json') {
                manager_1.requestSerializer = AFJSONRequestSerializer.serializer();
                manager_1.responseSerializer = AFJSONResponseSerializer.serializerWithReadingOptions(4);
            }
            else {
                manager_1.requestSerializer = AFHTTPRequestSerializer.serializer();
                manager_1.responseSerializer = AFHTTPResponseSerializer.serializer();
            }
            manager_1.requestSerializer.allowsCellularAccess = true;
            manager_1.securityPolicy = policies.secured == true ? policies.secure : policies.def;
            manager_1.requestSerializer.timeoutInterval = 10;
            var mergedHeaders_1 = cookie_1.mergeRequestHeaders(url, headers);
            Object.keys(mergedHeaders_1).forEach(function (key) {
                return manager_1.requestSerializer.setValueForHTTPHeaderField(mergedHeaders_1[key], key);
            });
            var dict_1 = null;
            if (body && types_1.isObject(body)) {
                dict_1 = NSMutableDictionary.new();
                Object.keys(body).forEach(function (key) { return dict_1.setValueForKey(body[key], key); });
            }
            manager_1.setTaskWillPerformHTTPRedirectionBlock(function (url, session, response, request) { return (followRedirects ? request : null); });
            return manager_1[methods[method]](url, dict_1, function (task, data) { return resolve(AFSuccess(task, data)); }, function (task, error) { return reject(AFFailure(task, error)); });
        }
        catch (error) {
            reject(error);
        }
    }).then(function (_a) {
        var content = _a.content, reason = _a.reason, task = _a.task;
        var sendi = {
            content: content,
            headers: {}
        };
        var response = task.response;
        if (!types_1.isNullOrUndefined(response)) {
            var statusCode = response.statusCode, allHeaderFields = response.allHeaderFields;
            sendi.statusCode = statusCode;
            allHeaderFields.enumerateKeysAndObjectsUsingBlock(function (k, v) { return (sendi.headers[k] = v); });
        }
        if (reason) {
            sendi.reason = reason;
        }
        cookie_1.handleCookie(url, sendi.headers);
        return sendi;
    });
}
exports.request = request;
//# sourceMappingURL=https.ios.js.map