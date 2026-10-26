// Stands in for the "obsidian" module when the API client runs in Node for the live test.
export async function requestUrl(req) {
	const res = await fetch(req.url, { method: req.method ?? "GET", headers: req.headers });
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = undefined;
	}
	if (req.throw !== false && res.status >= 400) throw new Error(`status ${res.status}`);
	return { status: res.status, text, json, headers: Object.fromEntries(res.headers) };
}
