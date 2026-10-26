import { Editor, Notice, Plugin } from "obsidian";
import { PrivatusClient, type Site } from "./api";
import { StatsCard } from "./card";
import { lastFullWeek, weeklySummaryMarkdown } from "./format";
import { DEFAULT_SETTINGS, PrivatusSettingTab, type PrivatusSettings } from "./settings";
import { SiteSuggestModal } from "./site-modal";

export const CODE_BLOCK = "privatus-analytics";

export default class PrivatusAnalyticsPlugin extends Plugin {
	settings: PrivatusSettings = { ...DEFAULT_SETTINGS };
	client!: PrivatusClient;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.client = new PrivatusClient(
			() => this.getToken(),
			() => this.settings.cacheMinutes,
		);

		this.registerMarkdownCodeBlockProcessor(CODE_BLOCK, (source, el, ctx) => {
			ctx.addChild(new StatsCard(el, this, source));
		});

		this.addCommand({
			id: "insert-weekly-summary",
			name: "Insert weekly traffic summary",
			editorCallback: (editor) => {
				void this.pickSite((site) => this.insertWeeklySummary(editor, site));
			},
		});

		this.addCommand({
			id: "insert-stats-card",
			name: "Insert live stats card",
			editorCallback: (editor) => {
				void this.pickSite((site) => {
					editor.replaceSelection(
						`\`\`\`${CODE_BLOCK}\nsite: ${site.domain}\nperiod: ${this.settings.defaultPeriod}\nshow: pages, referrers\n\`\`\`\n`,
					);
				});
			},
		});

		this.addSettingTab(new PrivatusSettingTab(this.app, this));
	}

	getToken(): string | null {
		if (!this.settings.tokenSecret) return null;
		const token = this.app.secretStorage.getSecret(this.settings.tokenSecret);
		return token && token.trim() !== "" ? token.trim() : null;
	}

	private async pickSite(onPick: (site: Site) => void | Promise<void>): Promise<void> {
		if (!this.getToken()) {
			new Notice("Add your Privatus Analytics API token in the plugin settings first.");
			return;
		}
		try {
			const sites = await this.client.listSites();
			if (sites.length === 0) {
				new Notice("This workspace has no sites yet.");
				return;
			}
			if (sites.length === 1 && sites[0]) {
				await onPick(sites[0]);
				return;
			}
			new SiteSuggestModal(this.app, sites, (site) => {
				void onPick(site);
			}).open();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async insertWeeklySummary(editor: Editor, site: Site): Promise<void> {
		const notice = new Notice(`Getting last week's numbers for ${site.domain}…`, 0);
		try {
			const { from, to } = lastFullWeek(site.timezone);
			const overview = await this.client.overview(site.id, { period: "custom", from, to, compare: true });
			const markdown = weeklySummaryMarkdown({
				siteName: site.name || site.domain,
				domain: site.domain,
				siteId: site.id,
				from,
				to,
				overview,
				top: this.settings.topRows,
			});
			editor.replaceSelection(markdown);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		} finally {
			notice.hide();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<PrivatusSettings> | null) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
