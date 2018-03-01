import * as application from 'tns-core-modules/application'
import { HttpRequestOptions, Headers, HttpResponse } from 'tns-core-modules/http'
import { isDefined, isNullOrUndefined, isObject } from 'tns-core-modules/utils/types'
import * as Https from './https.common'
import { handleCookie, mergeRequestHeaders } from './cookie';

interface Ipeer {
	enabled: boolean
	allowInvalidCertificates: boolean
	validatesDomainName: boolean
	host?: string
	certificate?: string
	x509Certificate?: java.security.cert.Certificate
}
let peer: Ipeer = {
	enabled: false,
	allowInvalidCertificates: false,
	validatesDomainName: true,
}
let followRedirects: boolean = true;

export function enableSSLPinning(options: Https.HttpsSSLPinningOptions) {
	if (!peer.host && !peer.certificate) {
		let certificate: string
		let inputStream: java.io.FileInputStream
		try {
			let file = new java.io.File(options.certificate)
			inputStream = new java.io.FileInputStream(file)
			let x509Certificate = java.security.cert.CertificateFactory.getInstance('X509').generateCertificate(inputStream)
			peer.x509Certificate = x509Certificate
			certificate = okhttp3.CertificatePinner.pin(x509Certificate)
			inputStream.close()
		} catch (error) {
			try {
				if (inputStream) {
					inputStream.close()
				}
			} catch (e) { }
			console.error('nativescript-https > enableSSLPinning error', error)
			return
		}
		peer.host = options.host
		peer.certificate = certificate
		if (options.allowInvalidCertificates == true) {
			peer.allowInvalidCertificates = true
		}
		if (options.validatesDomainName == false) {
			peer.validatesDomainName = false
		}
	}
	peer.enabled = true
	getClient(true)
	console.log('nativescript-https > Enabled SSL pinning')
}
export function disableSSLPinning() {
	peer.enabled = false
	getClient(true)
	console.log('nativescript-https > Disabled SSL pinning')
}
console.info('nativescript-https > Disabled SSL pinning by default')

export function setupRedirects(follow: boolean) {
	followRedirects = follow;
	getClient(true);
}

let Client: okhttp3.OkHttpClient
function getClient(reload: boolean = false): okhttp3.OkHttpClient {
	if (Client && reload == false) {
		return Client
	}

	const client = new okhttp3.OkHttpClient.Builder().followRedirects(followRedirects);

	if (peer.enabled == true) {
		if (peer.host || peer.certificate) {
			let spec = okhttp3.ConnectionSpec.MODERN_TLS
			client.connectionSpecs(java.util.Collections.singletonList(spec))

			let pinner = new okhttp3.CertificatePinner.Builder()
			pinner.add(peer.host, [peer.certificate])
			client.certificatePinner(pinner.build())

			if (peer.allowInvalidCertificates == false) {
				try {
					let x509Certificate = peer.x509Certificate
					let keyStore = java.security.KeyStore.getInstance(
						java.security.KeyStore.getDefaultType()
					)
					keyStore.load(null, null)
					// keyStore.setCertificateEntry(peer.host, x509Certificate)
					keyStore.setCertificateEntry('CA', x509Certificate)

					// let keyManagerFactory = javax.net.ssl.KeyManagerFactory.getInstance(
					// 	javax.net.ssl.KeyManagerFactory.getDefaultAlgorithm()
					// )
					let keyManagerFactory = javax.net.ssl.KeyManagerFactory.getInstance('X509')
					keyManagerFactory.init(keyStore, null)
					let keyManagers = keyManagerFactory.getKeyManagers()

					let trustManagerFactory = javax.net.ssl.TrustManagerFactory.getInstance(
						javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm()
					)
					trustManagerFactory.init(keyStore)

					let sslContext = javax.net.ssl.SSLContext.getInstance('TLS')
					sslContext.init(keyManagers, trustManagerFactory.getTrustManagers(), new java.security.SecureRandom())
					client.sslSocketFactory(sslContext.getSocketFactory())

				} catch (error) {
					console.error('nativescript-https > client.allowInvalidCertificates error', error)
				}
			}

			if (peer.validatesDomainName == true) {
				try {
					client.hostnameVerifier(new javax.net.ssl.HostnameVerifier({
						verify: function (hostname: string, session: javax.net.ssl.ISSLSession): boolean {
							let pp = session.getPeerPrincipal().getName()
							let hv = javax.net.ssl.HttpsURLConnection.getDefaultHostnameVerifier()
							return (
								hv.verify(peer.host, session) &&
								peer.host == hostname &&
								peer.host == session.getPeerHost() &&
								pp.indexOf(peer.host) != -1
							)
						},
					}))
				} catch (error) {
					console.error('nativescript-https > client.validatesDomainName error', error)
				}
			}

		} else {
			console.warn('nativescript-https > Undefined host or certificate. SSL pinning NOT working!!!')
		}
	}
	Client = client.build()
	return Client
}

// We have to allow networking on the main thread because larger responses will crash the app with an NetworkOnMainThreadException.
// Note that it would be better to offload it to an AsyncTask but that has to run natively to work properly.
// No time for that now, and actually it only concerns the '.string()' call of response.body().string() below.
const strictModeThreadPolicyPermitAll = new android.os.StrictMode.ThreadPolicy.Builder().permitAll().build()

export function request({ url, headers, body = {}, method }: Https.HttpsRequestOptions): Promise<Https.HttpsResponse> {
	return new Promise(function (resolve, reject) {
		try {
			const client = getClient();
			const request = new okhttp3.Request.Builder();
			const mergedHeaders = mergeRequestHeaders(url, headers);

			request.url(url);
			Object.keys(mergedHeaders).forEach(key => request.addHeader(key, <string>mergedHeaders[key]));

			const withoutBody = (['GET', 'HEAD'].includes(method)) || (method == 'DELETE' && !isDefined(body));
			const validMethod = method.toLowerCase();

			if (withoutBody) {
				request[validMethod]();
			} else {
				const type = headers['Content-Type'] || 'application/json';

				request[validMethod](okhttp3.RequestBody.create(
					okhttp3.MediaType.parse(type),
					isObject(body) ? JSON.stringify(body) : <any>body
				))
			}

			// enable our policy
			android.os.StrictMode.setThreadPolicy(strictModeThreadPolicyPermitAll)

			return client.newCall(request.build()).enqueue(new okhttp3.Callback({
				onResponse: function (task, response) {
					let content = response.body().string()
					try {
						content = JSON.parse(content)
					} catch (e) { }

					const statusCode = response.code()

					let headers = {}
					let heads: okhttp3.Headers = response.headers()
					let i: number, len: number = heads.size()
					for (i = 0; i < len; i++) {
						let key = heads.name(i)
						let value = heads.value(i)
						headers[key] = value
					}

					handleCookie(url, headers);

					resolve({ content, statusCode, headers })

				},
				onFailure: function (task, error) {
					reject(error)
				},
			}))

		} catch (error) {
			reject(error)
		}
	})
}

export * from './https.common'
