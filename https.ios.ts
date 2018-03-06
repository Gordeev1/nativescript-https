import * as application from 'tns-core-modules/application';
import { HttpRequestOptions, Headers, HttpResponse } from 'tns-core-modules/http';
import { isDefined, isNullOrUndefined, isObject, isString } from 'tns-core-modules/utils/types';
import * as Https from './https.common';
import { handleCookie, mergeRequestHeaders } from './cookie.common';

const methods = {
	GET: 'GETParametersSuccessFailure',
	POST: 'POSTParametersSuccessFailure',
	PUT: 'PUTParametersSuccessFailure',
	DELETE: 'DELETEParametersSuccessFailure',
	PATCH: 'PATCHParametersSuccessFailure',
	HEAD: 'HEADParametersSuccessFailure'
};

interface Ipolicies {
	def: AFSecurityPolicy;
	secured: boolean;
	secure?: AFSecurityPolicy;
}
let followRedirects: boolean = true;
let policies: Ipolicies = {
	def: AFSecurityPolicy.defaultPolicy(),
	secured: false
};
policies.def.allowInvalidCertificates = true;
policies.def.validatesDomainName = false;

export function enableSSLPinning(options: Https.HttpsSSLPinningOptions) {
	if (!policies.secure) {
		policies.secure = AFSecurityPolicy.policyWithPinningMode(AFSSLPinningMode.PublicKey);

		const allowInvalidCertificates = isDefined(options.allowInvalidCertificates)
			? options.allowInvalidCertificates
			: false;

		policies.secure.allowInvalidCertificates = allowInvalidCertificates;

		const validatesDomainName = isDefined(options.validatesDomainName)
			? options.validatesDomainName
			: true;

		policies.secure.validatesDomainName = validatesDomainName;

		const data = NSData.dataWithContentsOfFile(options.certificate);
		policies.secure.pinnedCertificates = NSSet.setWithObject(data);
	}
	policies.secured = true;
	console.log('nativescript-https > Enabled SSL pinning');
}

export function disableSSLPinning() {
	policies.secured = false;
	console.log('nativescript-https > Disabled SSL pinning');
}

console.info('nativescript-https > Disabled SSL pinning by default');

export function setupRedirects(follow: boolean) {
	followRedirects = follow;
	console.log('nativescript-https > Enable redirects');
}

function AFSuccess(
	task: NSURLSessionDataTask,
	data: NSDictionary<string, any> & NSData & NSArray<any>
): { task: NSURLSessionDataTask; content: any } {
	let content;
	if (data && data.class) {
		const { name } = data.class();

		if (data.enumerateKeysAndObjectsUsingBlock || name == 'NSArray') {
			const serial = NSJSONSerialization.dataWithJSONObjectOptionsError(
				data,
				NSJSONWritingOptions.PrettyPrinted
			);
			content = NSString.alloc()
				.initWithDataEncoding(serial, NSUTF8StringEncoding)
				.toString();
		}
		if (name == 'NSData') {
			content = NSString.alloc()
				.initWithDataEncoding(data, NSASCIIStringEncoding)
				.toString();
		} else {
			content = data;
		}

		try {
			content = JSON.parse(content);
		} catch (e) {}
	} else {
		content = data;
	}

	return { task, content };
}

function AFFailure(
	task: NSURLSessionDataTask,
	{ description, localizedDescription, userInfo }: NSError
): { task: NSURLSessionDataTask; content: any; reason: any } {
	const data: NSData = userInfo.valueForKey(AFNetworkingOperationFailingURLResponseDataErrorKey);

	let body = NSString.alloc()
		.initWithDataEncoding(data, NSUTF8StringEncoding)
		.toString();

	try {
		body = JSON.parse(body);
	} catch (e) {}

	const content = {
		body,
		description,
		reason: localizedDescription,
		url: userInfo.objectForKey('NSErrorFailingURLKey').description
	};
	if (policies.secured == true) {
		content.description =
			'nativescript-https > Invalid SSL certificate! ' + content.description;
	}
	return { task, content, reason: localizedDescription };
}

export function request({
	headers,
	body,
	url,
	method
}: Https.HttpsRequestOptions): Promise<Https.HttpsResponse> {
	return new Promise(function(resolve, reject) {
		try {
			const manager = AFHTTPSessionManager.manager();

			if (headers && headers['Content-Type'] == 'application/json') {
				manager.requestSerializer = AFJSONRequestSerializer.serializer();
				manager.responseSerializer = AFJSONResponseSerializer.serializerWithReadingOptions(
					NSJSONReadingOptions.AllowFragments
				);
			} else {
				manager.requestSerializer = AFHTTPRequestSerializer.serializer();
				manager.responseSerializer = AFHTTPResponseSerializer.serializer();
			}
			manager.requestSerializer.allowsCellularAccess = true;
			manager.securityPolicy = policies.secured == true ? policies.secure : policies.def;
			manager.requestSerializer.timeoutInterval = 10;

			const mergedHeaders = mergeRequestHeaders(url, headers);

			Object.keys(mergedHeaders).forEach(key =>
				manager.requestSerializer.setValueForHTTPHeaderField(mergedHeaders[key], key)
			);

			let dict: NSMutableDictionary<string, any> = null;

			if (body && isObject(body)) {
				dict = NSMutableDictionary.new<string, any>();
				Object.keys(body).forEach(key => dict.setValueForKey(body[key], key));
			}

			manager.setTaskWillPerformHTTPRedirectionBlock(
				(url, session, response, request) => (followRedirects ? request : null)
			);

			return manager[methods[method]](
				url,
				dict,
				(task: NSURLSessionDataTask, data) => resolve(AFSuccess(task, data)),
				(task, error) => reject(AFFailure(task, error))
			);
		} catch (error) {
			reject(error);
		}
	}).then(
		({
			content,
			reason,
			task
		}: {
			task: NSURLSessionDataTask;
			content: any;
			reason?: string;
		}) => {
			const sendi: Https.HttpsResponse = {
				content,
				headers: {}
			};

			const response = task.response as NSHTTPURLResponse;

			if (!isNullOrUndefined(response)) {
				const { statusCode, allHeaderFields } = response;
				sendi.statusCode = statusCode;
				handleCookie(url, allHeaderFields);
				allHeaderFields.enumerateKeysAndObjectsUsingBlock((k, v) => (sendi.headers[k] = v));
			}

			if (reason) {
				sendi.reason = reason;
			}

			return sendi;
		}
	);
}

export * from './https.common';
