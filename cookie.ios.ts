export function resolveCookieString(headers: NSDictionary<any, any>): string[] {
	const searchReg = /^set-cookie$/i;
	let result: string[] = [];

	headers.enumerateKeysAndObjectsUsingBlock((key, value) => {
		if (key.match(searchReg)) {
			result = [...result, value];
		}
	});

	return result;
}
