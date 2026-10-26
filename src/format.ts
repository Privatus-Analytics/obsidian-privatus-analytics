// Pure helpers with no Obsidian imports, so they can be tested with node --test.

export const PERIODS = [
	"today",
	"yesterday",
	"7d",
	"14d",
	"28d",
	"30d",
	"90d",
	"mtd",
	"last_month",
	"qtd",
	"last_quarter",
	"ytd",
	"12mo",
	"last_year",
	"all",
] as const;

export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
	today: "Today",
	yesterday: "Yesterday",
	"7d": "Last 7 days",
	"14d": "Last 14 days",
	"28d": "Last 28 days",
	"30d": "Last 30 days",
	"90d": "Last 90 days",
	mtd: "This month",
	last_month: "Last month",
	qtd: "This quarter",
	last_quarter: "Last quarter",
	ytd: "This year",
	"12mo": "Last 12 months",
	last_year: "Last year",
	all: "All time",
};

export const SECTIONS = ["pages", "referrers", "goals", "countries"] as const;
export type Section = (typeof SECTIONS)[number];

export interface CardOptions {
	site?: string;
	period: Period | "custom";
	from?: string;
	to?: string;
	top: number;
	show: Section[];
	compare: boolean;
}

export interface ParseResult {
	options: CardOptions;
	errors: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPeriod(value: string): value is Period {
	return (PERIODS as readonly string[]).includes(value);
}

function isSection(value: string): value is Section {
	return (SECTIONS as readonly string[]).includes(value);
}

/** Reads the "key: value" lines of a privatus-analytics code block. */
export function parseCardSource(source: string, defaults: { period: Period; top: number }): ParseResult {
	const options: CardOptions = {
		period: defaults.period,
		top: defaults.top,
		show: ["pages", "referrers"],
		compare: true,
	};
	const errors: string[] = [];

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.replace(/\s+#.*$/, "").trim();
		if (line === "" || line.startsWith("#")) continue;
		const colon = line.indexOf(":");
		if (colon === -1) {
			errors.push(`Line "${line}" needs a colon, like "period: 30d".`);
			continue;
		}
		const key = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();

		switch (key) {
			case "site":
				if (value) options.site = value;
				break;
			case "period": {
				const period = value.toLowerCase();
				if (isPeriod(period)) options.period = period;
				else errors.push(`"${value}" is not a period. Try 7d, 30d, mtd, 12mo or all.`);
				break;
			}
			case "from":
			case "to":
				if (DATE_RE.test(value)) options[key] = value;
				else errors.push(`"${key}" must be a date like 2026-01-31.`);
				break;
			case "top": {
				const top = Number.parseInt(value, 10);
				if (Number.isFinite(top) && top >= 0 && top <= 50) options.top = top;
				else errors.push(`"top" must be a number from 0 to 50.`);
				break;
			}
			case "show": {
				const parts = value
					.split(/[,\s]+/)
					.map((part) => part.trim().toLowerCase())
					.filter(Boolean);
				const valid = parts.filter(isSection);
				const invalid = parts.filter((part) => !isSection(part) && part !== "none");
				if (invalid.length > 0) {
					errors.push(`"show" can list ${SECTIONS.join(", ")} or none.`);
				}
				options.show = valid;
				break;
			}
			case "compare":
				options.compare = !["no", "false", "off", "none"].includes(value.toLowerCase());
				break;
			default:
				errors.push(`"${key}" is not a setting. Use site, period, from, to, top, show or compare.`);
		}
	}

	if (options.from || options.to) {
		if (options.from && options.to) {
			if (options.from > options.to) errors.push(`"from" must be on or before "to".`);
			else options.period = "custom";
		} else {
			errors.push(`Set both "from" and "to", or neither.`);
		}
	}

	return { options, errors };
}

export function periodLabel(options: Pick<CardOptions, "period" | "from" | "to">): string {
	if (options.period === "custom") return `${options.from ?? ""} to ${options.to ?? ""}`;
	return PERIOD_LABELS[options.period];
}

export function formatNumber(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return "–";
	if (Math.abs(value) >= 1_000_000) return `${trimZero((value / 1_000_000).toFixed(1))}M`;
	if (Math.abs(value) >= 10_000) return `${trimZero((value / 1_000).toFixed(1))}k`;
	return Math.round(value).toLocaleString("en-US");
}

function trimZero(text: string): string {
	return text.replace(/\.0$/, "");
}

export function formatPercent(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return "–";
	return `${trimZero(value.toFixed(1))}%`;
}

/** Durations from the API are in milliseconds. */
export function formatDuration(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return "0s";
	const totalSeconds = Math.round(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

export function formatChange(change: number | null | undefined): string {
	if (change === null || change === undefined || !Number.isFinite(change)) return "";
	const sign = change > 0 ? "+" : "";
	return `${sign}${trimZero(change.toFixed(1))}%`;
}

/** Points for an SVG polyline that fits the values into width x height. */
export function sparklinePoints(values: number[], width: number, height: number, pad = 2): string {
	if (values.length === 0) return "";
	const max = Math.max(...values, 0);
	const min = Math.min(...values, 0);
	const span = max - min || 1;
	const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
	return values
		.map((value, index) => {
			const x = values.length > 1 ? pad + index * step : width / 2;
			const y = height - pad - ((value - min) / span) * (height - pad * 2);
			return `${round(x)},${round(y)}`;
		})
		.join(" ");
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}

/** Today's date (YYYY-MM-DD) in a time zone, falling back to the device time zone. */
export function todayIn(timeZone: string | undefined, now: Date = new Date()): string {
	try {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(now);
	} catch {
		return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
	}
}

export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	const value = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

/** The last seven full days, ending yesterday, in the site's time zone. */
export function lastFullWeek(timeZone: string | undefined, now: Date = new Date()): { from: string; to: string } {
	const today = todayIn(timeZone, now);
	return { from: addDays(today, -7), to: addDays(today, -1) };
}

export interface Row {
	value: string;
	visitors?: number;
	pageviews?: number;
	completions?: number;
	conversions?: number;
	conversion_rate?: number;
	share?: number;
}

export interface Metrics {
	visitors?: number;
	visits?: number;
	pageviews?: number;
	views_per_visit?: number;
	bounce_rate?: number;
	visit_duration?: number;
	revenue?: number;
}

export interface Overview {
	period: { from: string; to: string };
	metrics: Metrics;
	comparison?: Metrics | null;
	change?: Partial<Record<keyof Metrics, number | null>> | null;
	series: Array<{ date: string } & Metrics>;
	panels: Partial<Record<string, Row[]>>;
	live_visitors?: number | null;
}

export function referrerLabel(value: string): string {
	return value === "" ? "Direct or unknown" : value;
}

export const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function countryLabel(code: string): string {
	if (!code) return "Unknown";
	try {
		return COUNTRY_NAMES.of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}

/** Makes text safe inside a Markdown table cell. */
export function mdCell(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/\|/g, "\\|")
		.replace(/([*_[\]`<>])/g, "\\$1")
		.replace(/\r?\n/g, " ");
}

function changeCell(change: number | null | undefined): string {
	const text = formatChange(change);
	return text === "" ? "–" : text;
}

export interface SummaryInput {
	siteName: string;
	domain: string;
	siteId: string;
	from: string;
	to: string;
	overview: Overview;
	top: number;
}

/** The weekly traffic summary as Markdown. */
export function weeklySummaryMarkdown(input: SummaryInput): string {
	const { overview, top } = input;
	const m = overview.metrics;
	const c = overview.change ?? {};
	const lines: string[] = [];

	lines.push(`## Traffic for ${mdCell(input.siteName)}, ${input.from} to ${input.to}`);
	lines.push("");

	const visitors = m.visitors ?? 0;
	const visitorsChange = c.visitors;
	let headline = `${formatNumber(visitors)} people visited ${mdCell(input.domain)} in these 7 days`;
	if (visitorsChange !== null && visitorsChange !== undefined && Number.isFinite(visitorsChange)) {
		const direction = visitorsChange >= 0 ? "up" : "down";
		headline += `, ${direction} ${trimZero(Math.abs(visitorsChange).toFixed(1))}% on the week before`;
	}
	lines.push(`${headline}.`);
	lines.push("");

	lines.push("| Metric | This week | Change |");
	lines.push("| --- | ---: | ---: |");
	lines.push(`| Visitors | ${formatNumber(m.visitors)} | ${changeCell(c.visitors)} |`);
	lines.push(`| Visits | ${formatNumber(m.visits)} | ${changeCell(c.visits)} |`);
	lines.push(`| Pageviews | ${formatNumber(m.pageviews)} | ${changeCell(c.pageviews)} |`);
	lines.push(`| Bounce rate | ${formatPercent(m.bounce_rate)} | ${changeCell(c.bounce_rate)} |`);
	lines.push(`| Visit length | ${formatDuration(m.visit_duration)} | ${changeCell(c.visit_duration)} |`);
	lines.push("");

	const series = overview.series ?? [];
	if (series.length > 0) {
		const best = series.reduce((a, b) => ((b.visitors ?? 0) > (a.visitors ?? 0) ? b : a));
		if ((best.visitors ?? 0) > 0) {
			lines.push(`Busiest day: ${best.date.slice(0, 10)} with ${formatNumber(best.visitors)} visitors.`);
			lines.push("");
		}
	}

	const pages = (overview.panels.page ?? []).slice(0, top);
	if (pages.length > 0) {
		lines.push("### Top pages");
		lines.push("");
		lines.push("| Page | Pageviews |");
		lines.push("| --- | ---: |");
		for (const row of pages) lines.push(`| ${mdCell(row.value)} | ${formatNumber(row.pageviews)} |`);
		lines.push("");
	}

	const referrers = (overview.panels.referrer ?? []).slice(0, top);
	if (referrers.length > 0) {
		lines.push("### Where visitors came from");
		lines.push("");
		lines.push("| Source | Visitors |");
		lines.push("| --- | ---: |");
		for (const row of referrers) {
			lines.push(`| ${mdCell(referrerLabel(row.value))} | ${formatNumber(row.visitors)} |`);
		}
		lines.push("");
	}

	const goals = (overview.panels.goal ?? []).slice(0, top);
	if (goals.length > 0) {
		lines.push("### Goals");
		lines.push("");
		lines.push("| Goal | Conversions | Rate |");
		lines.push("| --- | ---: | ---: |");
		for (const row of goals) {
			lines.push(
				`| ${mdCell(row.value)} | ${formatNumber(row.conversions)} | ${formatPercent(row.conversion_rate)} |`,
			);
		}
		lines.push("");
	}

	lines.push(`[Open the dashboard](https://privatusanalytics.com/sites/${encodeURIComponent(input.siteId)})`);
	lines.push("");
	return lines.join("\n");
}
