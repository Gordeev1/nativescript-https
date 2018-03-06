"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("tns-core-modules/utils/types");
var cookie_1 = require("./cookie");
var peer = {
    enabled: false,
    allowInvalidCertificates: false,
    validatesDomainName: true
};
var followRedirects = true;
function enableSSLPinning(options) {
    if (!peer.host && !peer.certificate) {
        var certificate = void 0;
        var inputStream = void 0;
        try {
            var file = new java.io.File(options.certificate);
            inputStream = new java.io.FileInputStream(file);
            var x509Certificate = java.security.cert.CertificateFactory.getInstance('X509').generateCertificate(inputStream);
            peer.x509Certificate = x509Certificate;
            certificate = okhttp3.CertificatePinner.pin(x509Certificate);
            inputStream.close();
        }
        catch (error) {
            try {
                if (inputStream) {
                    inputStream.close();
                }
            }
            catch (e) { }
            console.error('nativescript-https > enableSSLPinning error', error);
            return;
        }
        peer.host = options.host;
        peer.certificate = certificate;
        if (options.allowInvalidCertificates == true) {
            peer.allowInvalidCertificates = true;
        }
        if (options.validatesDomainName == false) {
            peer.validatesDomainName = false;
        }
    }
    peer.enabled = true;
    getClient(true);
    console.log('nativescript-https > Enabled SSL pinning');
}
exports.enableSSLPinning = enableSSLPinning;
function disableSSLPinning() {
    peer.enabled = false;
    getClient(true);
    console.log('nativescript-https > Disabled SSL pinning');
}
exports.disableSSLPinning = disableSSLPinning;
console.info('nativescript-https > Disabled SSL pinning by default');
function setupRedirects(follow) {
    followRedirects = follow;
    getClient(true);
}
exports.setupRedirects = setupRedirects;
var Client;
function getClient(reload) {
    if (reload === void 0) { reload = false; }
    if (Client && reload == false) {
        return Client;
    }
    var client = new okhttp3.OkHttpClient.Builder().followRedirects(followRedirects);
    if (peer.enabled == true) {
        if (peer.host || peer.certificate) {
            var spec = okhttp3.ConnectionSpec.MODERN_TLS;
            client.connectionSpecs(java.util.Collections.singletonList(spec));
            var pinner = new okhttp3.CertificatePinner.Builder();
            pinner.add(peer.host, [peer.certificate]);
            client.certificatePinner(pinner.build());
            if (peer.allowInvalidCertificates == false) {
                try {
                    var x509Certificate = peer.x509Certificate;
                    var keyStore = java.security.KeyStore.getInstance(java.security.KeyStore.getDefaultType());
                    keyStore.load(null, null);
                    keyStore.setCertificateEntry('CA', x509Certificate);
                    var keyManagerFactory = javax.net.ssl.KeyManagerFactory.getInstance('X509');
                    keyManagerFactory.init(keyStore, null);
                    var keyManagers = keyManagerFactory.getKeyManagers();
                    var trustManagerFactory = javax.net.ssl.TrustManagerFactory.getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm());
                    trustManagerFactory.init(keyStore);
                    var sslContext = javax.net.ssl.SSLContext.getInstance('TLS');
                    sslContext.init(keyManagers, trustManagerFactory.getTrustManagers(), new java.security.SecureRandom());
                    client.sslSocketFactory(sslContext.getSocketFactory());
                }
                catch (error) {
                    console.error('nativescript-https > client.allowInvalidCertificates error', error);
                }
            }
            if (peer.validatesDomainName == true) {
                try {
                    client.hostnameVerifier(new javax.net.ssl.HostnameVerifier({
                        verify: function (hostname, session) {
                            var pp = session.getPeerPrincipal().getName();
                            var hv = javax.net.ssl.HttpsURLConnection.getDefaultHostnameVerifier();
                            return (hv.verify(peer.host, session) &&
                                peer.host == hostname &&
                                peer.host == session.getPeerHost() &&
                                pp.indexOf(peer.host) != -1);
                        }
                    }));
                }
                catch (error) {
                    console.error('nativescript-https > client.validatesDomainName error', error);
                }
            }
        }
        else {
            console.warn('nativescript-https > Undefined host or certificate. SSL pinning NOT working!!!');
        }
    }
    Client = client.build();
    return Client;
}
var strictModeThreadPolicyPermitAll = new android.os.StrictMode.ThreadPolicy.Builder()
    .permitAll()
    .build();
function request(_a) {
    var url = _a.url, headers = _a.headers, _b = _a.body, body = _b === void 0 ? {} : _b, method = _a.method;
    return new Promise(function (resolve, reject) {
        try {
            var client = getClient();
            var request_1 = new okhttp3.Request.Builder();
            var mergedHeaders_1 = cookie_1.mergeRequestHeaders(url, headers);
            request_1.url(url);
            Object.keys(mergedHeaders_1).forEach(function (key) { return request_1.addHeader(key, mergedHeaders_1[key]); });
            var withoutBody = ['GET', 'HEAD'].includes(method) || (method == 'DELETE' && !types_1.isDefined(body));
            var validMethod = method.toLowerCase();
            if (withoutBody) {
                request_1[validMethod]();
            }
            else {
                var type = headers['Content-Type'] || 'application/json';
                request_1[validMethod](okhttp3.RequestBody.create(okhttp3.MediaType.parse(type), types_1.isObject(body) ? JSON.stringify(body) : body));
            }
            android.os.StrictMode.setThreadPolicy(strictModeThreadPolicyPermitAll);
            return client.newCall(request_1.build()).enqueue(new okhttp3.Callback({
                onResponse: function (task, response) {
                    var content = response.body().string();
                    try {
                        content = JSON.parse(content);
                    }
                    catch (e) { }
                    var statusCode = response.code();
                    var headers = {};
                    var heads = response.headers();
                    var len = heads.size();
                    cookie_1.handleCookie(url, heads);
                    for (var i = 0; i < len; i++) {
                        var key = heads.name(i);
                        var value = heads.value(i);
                        headers[key] = value;
                    }
                    resolve({ content: content, statusCode: statusCode, headers: headers });
                },
                onFailure: function (task, error) {
                    reject(error);
                }
            }));
        }
        catch (error) {
            reject(error);
        }
    });
}
exports.request = request;
//# sourceMappingURL=https.android.js.map