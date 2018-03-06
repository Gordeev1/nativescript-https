import { Headers } from 'tns-core-modules/http';
import { HttpsResponse } from './https.common';
import { isAndroid } from 'tns-core-modules/platform';
import * as AppSettings from 'tns-core-modules/application-settings';
const MobileStorageCookieStore = require('tough-cookie-mobile-storage-store');
import { CookieJar } from 'tough-cookie-no-native';

const STORE_KEY = 'NS_COOKIE_STORE';

class NSStorageWrapper {
	getItem = (key: string) => AppSettings.getString(key);
	setItem = (key: string, value: string) => AppSettings.setString(key, value);
}

const store = new MobileStorageCookieStore(new NSStorageWrapper(), STORE_KEY);
export const cookieJar = new CookieJar(store);

export function resolveCookieStringAndroid(headers: okhttp3.Headers): string[] {
	const searchReg = /^set-cookie$/i;
	const length: number = headers.size();

	let result: string[] = [];

	for (let i = 0; i < length; i++) {
		const key = headers.name(i);
		if (key.match(searchReg)) {
			const value = headers.value(i);
			result = [...result, value];
		}
	}

	return result;
}

export function resolveCookieStringIOS(headers: NSDictionary<any, any>): string[] {
	const searchReg = /^set-cookie$/i;
	let result: string[] = [];

	headers.enumerateKeysAndObjectsUsingBlock((key, value) => {
		if (key.match(searchReg)) {
			result = [...result, value];
		}
	});

	return result;
}

export function handleCookie(url: string, headers: okhttp3.Headers | NSDictionary<any, any>): void {
	const cookies = isAndroid
		? resolveCookieStringAndroid(<okhttp3.Headers>headers)
		: resolveCookieStringIOS(<NSDictionary<any, any>>headers);

	console.log('received cookie');
	try {
		console.dir(JSON.stringify(cookies));
	} catch (error) {
		console.log(error.message);
	}

	return (
		cookies &&
		cookies.length &&
		cookies.forEach(cookie => cookieJar.setCookieSync(cookie, url, { ignoreError: true }))
	);
}

function resolvePassedCookieString(headers: Headers = {}): string {
	const searchReg = /^cookie$/i;
	const key = Object.keys(headers).find(key => Boolean(key.match(searchReg)));
	const cookie = headers[key];
	return Array.isArray(cookie)
		? cookie.filter(str => str).reduce((s1, s2) => `${s1}; ${s2}`, '')
		: cookie;
}

export function mergeRequestHeaders(url: string, headers = {}): { [key: string]: string } {
	const cookies = resolvePassedCookieString(headers);
	const existingCookies = cookieJar.getCookieStringSync(url);

	console.log('existing cookie');
	try {
		console.dir(JSON.stringify(existingCookies));
	} catch (error) {
		console.log(error.message);
	}

	const mergedCookies = [cookies, existingCookies]
		.filter(str => str)
		.reduce((s1, s2) => `${s1}; ${s2}`, '');

	return mergedCookies ? { ...headers, Cookie: mergedCookies } : headers;
}

export function clearCookies(): void {
	return AppSettings.remove(STORE_KEY);
}
