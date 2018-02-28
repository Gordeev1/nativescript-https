import * as application from 'tns-core-modules/application'
import { HttpRequestOptions, Headers, HttpResponse } from 'tns-core-modules/http'
import { isDefined, isNullOrUndefined, isObject, isString } from 'tns-core-modules/utils/types'
import * as Https from './https.common'

interface Ipolicies {
	def: AFSecurityPolicy
	secured: boolean
	secure?: AFSecurityPolicy
}
let followRedirects: boolean = true;
let policies: Ipolicies = {
	def: AFSecurityPolicy.defaultPolicy(),
	secured: false,
}
policies.def.allowInvalidCertificates = true
policies.def.validatesDomainName = false

export function enableSSLPinning(options: Https.HttpsSSLPinningOptions) {
	if (!policies.secure) {
		policies.secure = AFSecurityPolicy.policyWithPinningMode(AFSSLPinningMode.PublicKey)
		let allowInvalidCertificates = (isDefined(options.allowInvalidCertificates)) ? options.allowInvalidCertificates : false
		policies.secure.allowInvalidCertificates = allowInvalidCertificates
		let validatesDomainName = (isDefined(options.validatesDomainName)) ? options.validatesDomainName : true
		policies.secure.validatesDomainName = validatesDomainName
		let data = NSData.dataWithContentsOfFile(options.certificate)
		policies.secure.pinnedCertificates = NSSet.setWithObject(data)
	}
	policies.secured = true
	console.log('nativescript-https > Enabled SSL pinning')
}
export function disableSSLPinning() {
	policies.secured = false
	console.log('nativescript-https > Disabled SSL pinning')
}
console.info('nativescript-https > Disabled SSL pinning by default')

export function setupRedirects(follow: boolean) {
	followRedirects = follow;
}

function AFSuccess(resolve, task: NSURLSessionDataTask, data: NSDictionary<string, any> & NSData & NSArray<any>) {
	let content: any
	if (data && data.class) {
		if (data.enumerateKeysAndObjectsUsingBlock || data.class().name == 'NSArray') {
			let serial = NSJSONSerialization.dataWithJSONObjectOptionsError(data, NSJSONWritingOptions.PrettyPrinted)
			content = NSString.alloc().initWithDataEncoding(serial, NSUTF8StringEncoding).toString()
		} else if (data.class().name == 'NSData') {
			content = NSString.alloc().initWithDataEncoding(data, NSASCIIStringEncoding).toString()
		} else {
			content = data
		}

		try {
			content = JSON.parse(content)
		} catch (e) { }

	} else {
		content = data
	}

	resolve({ task, content })
}

function AFFailure(resolve, reject, task: NSURLSessionDataTask, error: NSError) {
	let data: NSData = error.userInfo.valueForKey(AFNetworkingOperationFailingURLResponseDataErrorKey)
	let body = NSString.alloc().initWithDataEncoding(data, NSUTF8StringEncoding).toString()
	try {
		body = JSON.parse(body)
	} catch (e) { }
	let content: any = {
		body,
		description: error.description,
		reason: error.localizedDescription,
		url: error.userInfo.objectForKey('NSErrorFailingURLKey').description
	}
	if (policies.secured == true) {
		content.description = 'nativescript-https > Invalid SSL certificate! ' + content.description
	}
	let reason = error.localizedDescription
	resolve({ task, content, reason })
}

export function request(opts: Https.HttpsRequestOptions): Promise<Https.HttpsResponse> {
	return new Promise(function (resolve, reject) {
		try {

			let manager = AFHTTPSessionManager.manager()

			if (opts.headers && opts.headers['Content-Type'] == 'application/json') {
				manager.requestSerializer = AFJSONRequestSerializer.serializer()
				manager.responseSerializer = AFJSONResponseSerializer.serializerWithReadingOptions(NSJSONReadingOptions.AllowFragments)
			} else {
				manager.requestSerializer = AFHTTPRequestSerializer.serializer()
				manager.responseSerializer = AFHTTPResponseSerializer.serializer()
			}
			manager.requestSerializer.allowsCellularAccess = true
			manager.securityPolicy = (policies.secured == true) ? policies.secure : policies.def
			manager.requestSerializer.timeoutInterval = 10

			let heads = opts.headers
			if (heads) {
				Object.keys(heads).forEach(function (key) {
					manager.requestSerializer.setValueForHTTPHeaderField(heads[key] as any, key)
				})
			}

			let dict: NSMutableDictionary<string, any> = null
			if (opts.body) {
				let cont = opts.body
				if (isObject(cont)) {
					dict = NSMutableDictionary.new<string, any>()
					Object.keys(cont).forEach(function (key) {
						dict.setValueForKey(cont[key] as any, key)
					})
				}
			}

			manager.setTaskWillPerformHTTPRedirectionBlock((url, session, response, request) => followRedirects ? request : null);

			let methods = {
				'GET': 'GETParametersSuccessFailure',
				'POST': 'POSTParametersSuccessFailure',
				'PUT': 'PUTParametersSuccessFailure',
				'DELETE': 'DELETEParametersSuccessFailure',
				'PATCH': 'PATCHParametersSuccessFailure',
				'HEAD': 'HEADParametersSuccessFailure',
			}
			manager[methods[opts.method]](opts.url, dict, function success(task: NSURLSessionDataTask, data: any) {
				AFSuccess(resolve, task, data)
			}, function failure(task, error) {
				AFFailure(resolve, reject, task, error)
			})

		} catch (error) {
			reject(error)
		}

	}).then(function (AFResponse: {
		task: NSURLSessionDataTask
		content: any
		reason?: string
	}) {

		let sendi: Https.HttpsResponse = {
			content: AFResponse.content,
			headers: {},
		}

		let response = AFResponse.task.response as NSHTTPURLResponse
		if (!isNullOrUndefined(response)) {
			sendi.statusCode = response.statusCode
			let dict = response.allHeaderFields
			dict.enumerateKeysAndObjectsUsingBlock(function (k, v) {
				sendi.headers[k] = v
			})
		}

		if (AFResponse.reason) {
			sendi.reason = AFResponse.reason
		}
		return Promise.resolve(sendi)

	})
}

export * from './https.common'
