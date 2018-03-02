import { Headers } from 'tns-core-modules/http';
import { HttpsResponse } from './https.common';
import * as AppSettings from 'tns-core-modules/application-settings';
import MobileStorageCookieStore from 'tough-cookie-mobile-storage-store';
import { CookieJar } from 'tough-cookie-no-native';

const STORE_KEY = 'NS_COOKIE_STORE';

class NSStorageWrapper {
	getItem = (key: string) => AppSettings.getString(key);
	setItem = (key: string, value: string) => AppSettings.setString(key, value);
}

const store = new MobileStorageCookieStore(new NSStorageWrapper(), STORE_KEY);
const cookieJar = new CookieJar(store);

function resolveCookieString(
	headers: Headers = {},
	{ existing }: { existing?: boolean } = {}
): string {
	const searchReg = existing ? /^cookie$/i : /^set-cookie$/i;
	const key = Object.keys(headers).find(key => Boolean(key.match(searchReg)));
	const cookie = headers[key];
	return Array.isArray(cookie) ? cookie.reduce((s1, s2) => `${s1},${s2}`, '') : cookie;
}

export function handleCookie(url: string, headers: Headers) {
	const cookies = resolveCookieString(headers);

	console.log('received cookie');
	try {
		console.dir(JSON.stringify(cookies));
	} catch (error) {
		console.log(error.message);
	}

	cookies &&
		cookies
			.split(',')
			.map(cookie => cookie.trim())
			.forEach(cookie => cookieJar.setCookieSync(cookie, url, { ignoreError: true }));
}

export function mergeRequestHeaders(url: string, headers = {}): { [key: string]: string } {
	const cookies = resolveCookieString(headers, { existing: true });
	const existingCookies = cookieJar.getCookieStringSync(url);

	console.log('existing cookie');
	try {
		console.dir(JSON.stringify(existingCookies));
	} catch (error) {
		console.log(error.message);
	}

	const mergedCookie = [cookies, existingCookies]
		.filter(str => str)
		.reduce((s1, s2) => s1 + s2, '');

	return mergedCookie ? { ...headers, Cookie: mergedCookie } : headers;
}

export function clearCookies(): void {
	return AppSettings.remove(STORE_KEY);
}
