import { MarkdownRenderChild, setIcon } from "obsidian";
import {
	countryLabel,
	formatChange,
	formatDuration,
	formatNumber,
	formatPercent,
	parseCardSource,
	periodLabel,
	referrerLabel,
	sparklinePoints,
	type CardOptions,
	type Overview,
	type Row,
} from "./format";
import { BASE_URL, type Site } from "./api";
import type PrivatusAnalyticsPlugin from "./main";

/** The live stats card shown for a privatus-analytics code block. */
export class StatsCard extends MarkdownRenderChild {
	private options: CardOptions;
	private errors: string[];

	constructor(
		containerEl: HTMLElement,
		private readonly plugin: PrivatusAnalyticsPlugin,
		source: string,
	) {
		super(containerEl);
		const parsed = parseCardSource(source, {
			period: plugin.settings.defaultPeriod,
			top: plugin.settings.topRows,
		});
		this.options = parsed.options;
		this.errors = parsed.errors;
	}

	onload(): void {
		void this.render(false);
	}

	private async render(force: boolean): Promise<void> {
		const root = this.containerEl;
		root.empty();
		root.addClass("privatus-card");

		if (this.errors.length > 0) {
			this.showMessage(root, "This stats card has a mistake:", this.errors);
			return;
		}
		if (!this.plugin.getToken()) {
			this.showMessage(root, "Add your Privatus Analytics API token in the plugin settings to see your stats.");
			return;
		}
		const siteRef = this.options.site ?? this.plugin.settings.defaultSite;
		if (!siteRef) {
			this.showMessage(root, 'Add a line like "site: example.com", or pick a default site in the plugin settings.');
			return;
		}

		root.createDiv({ cls: "privatus-card-loading", text: "Loading stats…" });

		try {
			const site = await this.plugin.client.findSite(siteRef);
			const overview = await this.plugin.client.overview(
				site.id,
				{
					period: this.options.period,
					from: this.options.from,
					to: this.options.to,
					compare: this.options.compare,
				},
				force,
			);
			root.empty();
			this.draw(root, site, overview);
		} catch (error) {
			root.empty();
			this.showMessage(root, error instanceof Error ? error.message : String(error));
		}
	}

	private showMessage(root: HTMLElement, text: string, details: string[] = []): void {
		const box = root.createDiv({ cls: "privatus-card-message" });
		box.createSpan({ text });
		if (details.length > 0) {
			const list = box.createEl("ul");
			for (const detail of details) list.createEl("li", { text: detail });
		}
	}

	private draw(root: HTMLElement, site: Site, overview: Overview): void {
		const header = root.createDiv({ cls: "privatus-card-header" });
		const title = header.createDiv({ cls: "privatus-card-title" });
		title.createEl("a", {
			text: site.name || site.domain,
			href: `${BASE_URL}/sites/${encodeURIComponent(site.id)}`,
			cls: "privatus-card-site",
		});
		title.createSpan({ text: periodLabel(this.options), cls: "privatus-card-period" });

		const actions = header.createDiv({ cls: "privatus-card-actions" });
		if (typeof overview.live_visitors === "number") {
			actions.createSpan({
				cls: "privatus-card-live",
				text: `${formatNumber(overview.live_visitors)} online now`,
			});
		}
		const refresh = actions.createEl("button", {
			cls: "clickable-icon privatus-card-refresh",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refresh, "refresh-cw");
		this.registerDomEvent(refresh, "click", () => {
			void this.render(true);
		});

		const m = overview.metrics;
		const change = this.options.compare ? (overview.change ?? {}) : {};
		const tiles = root.createDiv({ cls: "privatus-card-metrics" });
		this.metric(tiles, "Visitors", formatNumber(m.visitors), change.visitors, false);
		this.metric(tiles, "Pageviews", formatNumber(m.pageviews), change.pageviews, false);
		this.metric(tiles, "Bounce rate", formatPercent(m.bounce_rate), change.bounce_rate, true);
		this.metric(tiles, "Visit length", formatDuration(m.visit_duration), change.visit_duration, false);

		const values = (overview.series ?? []).map((point) => point.visitors ?? 0);
		if (values.length > 1) this.sparkline(root, values);

		const top = this.options.top;
		const lists = root.createDiv({ cls: "privatus-card-lists" });
		for (const section of this.options.show) {
			if (top === 0) break;
			if (section === "pages") {
				this.list(lists, "Top pages", "Pageviews", overview.panels.page, top, (row) => row.value, (row) => row.pageviews);
			} else if (section === "referrers") {
				this.list(lists, "Top sources", "Visitors", overview.panels.referrer, top, (row) => referrerLabel(row.value), (row) => row.visitors);
			} else if (section === "goals") {
				this.list(lists, "Goals", "Conversions", overview.panels.goal, top, (row) => row.value, (row) => row.conversions);
			} else if (section === "countries") {
				this.list(lists, "Countries", "Visitors", overview.panels.country, top, (row) => countryLabel(row.value), (row) => row.visitors);
			}
		}
	}

	private metric(
		parent: HTMLElement,
		label: string,
		value: string,
		change: number | null | undefined,
		lowerIsBetter: boolean,
	): void {
		const tile = parent.createDiv({ cls: "privatus-card-metric" });
		tile.createDiv({ cls: "privatus-card-metric-label", text: label });
		tile.createDiv({ cls: "privatus-card-metric-value", text: value });
		const text = formatChange(change);
		if (text && change !== null && change !== undefined) {
			const good = lowerIsBetter ? change < 0 : change > 0;
			const cls = change === 0 ? "is-flat" : good ? "is-up" : "is-down";
			tile.createDiv({ cls: `privatus-card-metric-change ${cls}`, text });
		}
	}

	private sparkline(parent: HTMLElement, values: number[]): void {
		const width = 300;
		const height = 48;
		const wrap = parent.createDiv({ cls: "privatus-card-spark" });
		const svg = wrap.createSvg("svg", {
			attr: {
				viewBox: `0 0 ${width} ${height}`,
				preserveAspectRatio: "none",
				role: "img",
				"aria-label": "Visitors over time",
			},
		});
		const points = sparklinePoints(values, width, height);
		svg.createSvg("polygon", {
			cls: "privatus-card-spark-area",
			attr: { points: `2,${height - 2} ${points} ${width - 2},${height - 2}` },
		});
		svg.createSvg("polyline", {
			cls: "privatus-card-spark-line",
			attr: { points, fill: "none", "vector-effect": "non-scaling-stroke" },
		});
	}

	private list(
		parent: HTMLElement,
		title: string,
		metricLabel: string,
		rows: Row[] | undefined,
		top: number,
		label: (row: Row) => string,
		metric: (row: Row) => number | undefined,
	): void {
		const block = parent.createDiv({ cls: "privatus-card-list" });
		const head = block.createDiv({ cls: "privatus-card-list-head" });
		head.createSpan({ text: title });
		head.createSpan({ text: metricLabel });
		const shown = (rows ?? []).slice(0, top);
		if (shown.length === 0) {
			block.createDiv({ cls: "privatus-card-empty", text: "Nothing yet for this period." });
			return;
		}
		const max = Math.max(...shown.map((row) => metric(row) ?? 0), 1);
		for (const row of shown) {
			const item = block.createDiv({ cls: "privatus-card-row" });
			const bar = item.createDiv({ cls: "privatus-card-bar" });
			bar.setCssProps({ "--privatus-bar": `${Math.round(((metric(row) ?? 0) / max) * 100)}%` });
			item.createSpan({ cls: "privatus-card-row-label", text: label(row) });
			item.createSpan({ cls: "privatus-card-row-value", text: formatNumber(metric(row)) });
		}
	}
}
