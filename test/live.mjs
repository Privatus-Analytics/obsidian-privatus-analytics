// Live check against the real API: PRIVATUS_TOKEN=pat_... node test/live.mjs [site]
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, ".build", "live-entry.mjs");
await build({
	stdin: {
		contents: `export { PrivatusClient } from "../src/api"; export * from "../src/format";`,
		resolveDir: here,
		loader: "ts",
	},
	bundle: true,
	format: "esm",
	platform: "node",
	outfile: out,
	alias: { obsidian: path.join(here, "obsidian-shim.mjs") },
	logLevel: "warning",
});
const lib = await import(out);

const token = process.env.PRIVATUS_TOKEN;
if (!token) throw new Error("Set PRIVATUS_TOKEN");
const client = new lib.PrivatusClient(() => token, () => 10);

const sites = await client.listSites();
console.log(`sites: ${sites.length}`);
const site = await client.findSite(process.argv[2] ?? sites[0].domain);
console.log(`found: ${site.id} ${site.domain} tz=${site.timezone}`);

const card = lib.parseCardSource("period: 7d\nshow: pages, referrers, goals, countries", { period: "30d", top: 5 });
const ov = await client.overview(site.id, { period: card.options.period, compare: true });
console.log(`7d visitors=${ov.metrics.visitors} change=${ov.change?.visitors} series=${ov.series.length} live=${ov.live_visitors}`);
console.log(`panels: ${Object.keys(ov.panels).join(",")}`);
console.log(`sparkline: ${lib.sparklinePoints(ov.series.map((p) => p.visitors ?? 0), 300, 48).slice(0, 60)}…`);

const t0 = Date.now();
await client.overview(site.id, { period: "7d", compare: true });
console.log(`cached second call: ${Date.now() - t0} ms`);

const custom = await client.overview(site.id, { period: "custom", from: "2026-10-01", to: "2026-10-07", compare: false });
console.log(`custom range series=${custom.series.length} comparison=${custom.comparison ?? null}`);

const week = lib.lastFullWeek(site.timezone);
const weekly = await client.overview(site.id, { period: "custom", ...week, compare: true });
console.log("---- weekly summary ----");
console.log(lib.weeklySummaryMarkdown({ siteName: site.name, domain: site.domain, siteId: site.id, ...week, overview: weekly, top: 5 }));

try {
	await client.findSite("no-such-site.example");
} catch (e) {
	console.log(`missing site: ${e.message}`);
}
const bad = new lib.PrivatusClient(() => "pat_wrong", () => 10);
try {
	await bad.listSites();
} catch (e) {
	console.log(`bad token: ${e.status} ${e.message}`);
}
const none = new lib.PrivatusClient(() => null, () => 10);
try {
	await none.listSites();
} catch (e) {
	console.log(`no token: ${e.message}`);
}
