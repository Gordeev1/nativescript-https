export function resolveCookieString(headers: okhttp3.Headers): string[] {
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
