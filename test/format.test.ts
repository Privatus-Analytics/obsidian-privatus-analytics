import { test } from "node:test";
import assert from "node:assert/strict";
import {
	addDays,
	formatChange,
	formatDuration,
	formatNumber,
	lastFullWeek,
	mdCell,
	parseCardSource,
	sparklinePoints,
	weeklySummaryMarkdown,
	type Overview,
} from "../src/format.ts";

const defaults = { period: "30d" as const, top: 5 };

test("parses a full card", () => {
	const { options, errors } = parseCardSource(
		"site: example.com\nperiod: 7d  # a comment\ntop: 3\nshow: pages, goals\ncompare: no",
		defaults,
	);
	assert.deepEqual(errors, []);
	assert.equal(options.site, "example.com");
	assert.equal(options.period, "7d");
	assert.equal(options.top, 3);
	assert.deepEqual(options.show, ["pages", "goals"]);
	assert.equal(options.compare, false);
});

test("an empty card uses the defaults", () => {
	const { options, errors } = parseCardSource("", defaults);
	assert.deepEqual(errors, []);
	assert.equal(options.period, "30d");
	assert.equal(options.site, undefined);
	assert.deepEqual(options.show, ["pages", "referrers"]);
});

test("from and to make a custom period", () => {
	const { options, errors } = parseCardSource("from: 2026-10-01\nto: 2026-10-07", defaults);
	assert.deepEqual(errors, []);
	assert.equal(options.period, "custom");
});

test("reports mistakes in plain words", () => {
	const { errors } = parseCardSource("period: forever\ncolour: red\nfrom: 2026-10-01\ntop: 99\nnonsense", defaults);
	assert.equal(errors.length, 5);
	assert.match(errors.join(" "), /not a period/);
	assert.match(errors.join(" "), /not a setting/);
	assert.match(errors.join(" "), /both "from" and "to"/);
});

test("formats numbers, durations and changes", () => {
	assert.equal(formatNumber(1234), "1,234");
	assert.equal(formatNumber(12_345), "12.3k");
	assert.equal(formatNumber(2_000_000), "2M");
	assert.equal(formatNumber(null), "–");
	assert.equal(formatDuration(5989), "6s");
	assert.equal(formatDuration(100_000), "1m 40s");
	assert.equal(formatDuration(3_900_000), "1h 5m");
	assert.equal(formatChange(31.6), "+31.6%");
	assert.equal(formatChange(-64.2), "-64.2%");
	assert.equal(formatChange(null), "");
});

test("dates and the last full week", () => {
	assert.equal(addDays("2026-03-01", -1), "2026-02-28");
	const week = lastFullWeek("UTC", new Date("2026-10-26T10:00:00Z"));
	assert.deepEqual(week, { from: "2026-10-19", to: "2026-10-25" });
	const ahead = lastFullWeek("Asia/Singapore", new Date("2026-10-26T20:00:00Z"));
	assert.deepEqual(ahead, { from: "2026-10-20", to: "2026-10-26" });
});

test("sparkline points stay inside the box", () => {
	const points = sparklinePoints([0, 5, 10], 100, 20).split(" ");
	assert.equal(points.length, 3);
	assert.equal(points[0], "2,18");
	assert.equal(points[2], "98,2");
});

test("table cells are escaped", () => {
	assert.equal(mdCell("/a|b*c"), "/a\\|b\\*c");
});

test("weekly summary Markdown", () => {
	const overview: Overview = {
		period: { from: "", to: "" },
		metrics: { visitors: 621, visits: 717, pageviews: 4017, bounce_rate: 43.7, visit_duration: 5989 },
		change: { visitors: 31.6, visits: 29.7, pageviews: -64.2, bounce_rate: 15, visit_duration: -18.6 },
		series: [
			{ date: "2026-10-20T00:00:00Z", visitors: 141 },
			{ date: "2026-10-21T00:00:00Z", visitors: 106 },
		],
		panels: {
			page: [{ value: "/pricing", pageviews: 216 }],
			referrer: [{ value: "", visitors: 483 }],
			goal: [{ value: "Signed up", conversions: 62, conversion_rate: 8.67 }],
		},
	};
	const md = weeklySummaryMarkdown({
		siteName: "Example",
		domain: "example.com",
		siteId: "pa_TEST",
		from: "2026-10-19",
		to: "2026-10-25",
		overview,
		top: 5,
	});
	assert.match(md, /^## Traffic for Example, 2026-10-19 to 2026-10-25/);
	assert.match(md, /621 people visited example.com in these 7 days, up 31.6% on the week before\./);
	assert.match(md, /\| Pageviews \| 4,017 \| -64.2% \|/);
	assert.match(md, /Busiest day: 2026-10-20 with 141 visitors\./);
	assert.match(md, /\| Direct or unknown \| 483 \|/);
	assert.match(md, /\| Signed up \| 62 \| 8.7% \|/);
	assert.match(md, /\(https:\/\/privatusanalytics.com\/sites\/pa_TEST\)/);
});
