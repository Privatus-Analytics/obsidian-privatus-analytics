import { App, DropdownComponent, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import { PERIOD_LABELS, PERIODS, type Period } from "./format";
import type PrivatusAnalyticsPlugin from "./main";

export interface PrivatusSettings {
	/** Name of the entry in Obsidian's secret storage that holds the API token. */
	tokenSecret: string;
	defaultSite: string;
	defaultPeriod: Period;
	topRows: number;
	cacheMinutes: number;
}

export const DEFAULT_SETTINGS: PrivatusSettings = {
	tokenSecret: "",
	defaultSite: "",
	defaultPeriod: "30d",
	topRows: 5,
	cacheMinutes: 10,
};

export class PrivatusSettingTab extends PluginSettingTab {
	private siteDropdown: DropdownComponent | null = null;

	constructor(
		app: App,
		private readonly plugin: PrivatusAnalyticsPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("p", {
			text: "Your website numbers live in a different app from your notes. This plugin puts them right in your notes, so your plans and your traffic sit side by side.",
		});

		const signUp = containerEl.createEl("p");
		signUp.appendText("You need a Privatus Analytics account. ");
		signUp.createEl("a", {
			text: "Make a free account",
			href: "https://privatusanalytics.com/users/sign_up",
		});
		signUp.appendText(" if you do not have one.");

		new Setting(containerEl)
			.setName("API token")
			.setDesc(
				"In Privatus Analytics, open workspace settings, then API tokens, and make a token. It starts with pat_. Obsidian keeps it in its secret storage, not in your vault.",
			)
			.addComponent((el) =>
				new SecretComponent(this.app, el).setValue(this.plugin.settings.tokenSecret).onChange(async (value) => {
					this.plugin.settings.tokenSecret = value ?? "";
					await this.plugin.saveSettings();
					this.plugin.client.clearCache();
				}),
			);

		new Setting(containerEl)
			.setName("Check the token")
			.setDesc("Loads your sites to make sure the token works.")
			.addButton((button) =>
				button.setButtonText("Check").onClick(async () => {
					try {
						const sites = await this.plugin.client.listSites(true);
						new Notice(`The token works. Found ${sites.length} site${sites.length === 1 ? "" : "s"}.`);
						if (this.siteDropdown) await this.fillSites(this.siteDropdown);
					} catch (error) {
						new Notice(error instanceof Error ? error.message : String(error));
					}
				}),
			);

		const siteSetting = new Setting(containerEl)
			.setName("Default site")
			.setDesc("Used when a stats card does not name a site.");
		siteSetting.addDropdown((dropdown) => {
			this.siteDropdown = dropdown;
			dropdown.addOption("", "Choose a site");
			if (this.plugin.settings.defaultSite) {
				dropdown.addOption(this.plugin.settings.defaultSite, this.plugin.settings.defaultSite);
			}
			dropdown.setValue(this.plugin.settings.defaultSite);
			dropdown.onChange(async (value) => {
				this.plugin.settings.defaultSite = value;
				await this.plugin.saveSettings();
			});
			void this.fillSites(dropdown);
		});

		new Setting(containerEl)
			.setName("Default period")
			.setDesc("Used when a stats card does not set a period.")
			.addDropdown((dropdown) => {
				for (const period of PERIODS) dropdown.addOption(period, PERIOD_LABELS[period]);
				dropdown.setValue(this.plugin.settings.defaultPeriod).onChange(async (value) => {
					this.plugin.settings.defaultPeriod = value as Period;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Rows in top lists")
			.setDesc("How many pages, sources and goals to show.")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.topRows)
					.onChange(async (value) => {
						this.plugin.settings.topRows = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Keep numbers for (minutes)")
			.setDesc("Cards reuse numbers for this long before asking again. The refresh button always gets fresh numbers.")
			.addSlider((slider) =>
				slider
					.setLimits(1, 60, 1)
					.setValue(this.plugin.settings.cacheMinutes)
					.onChange(async (value) => {
						this.plugin.settings.cacheMinutes = value;
						await this.plugin.saveSettings();
					}),
			);
	}

	private async fillSites(dropdown: DropdownComponent): Promise<void> {
		if (!this.plugin.getToken()) return;
		try {
			const sites = await this.plugin.client.listSites();
			const current = this.plugin.settings.defaultSite;
			dropdown.selectEl.empty();
			dropdown.addOption("", "Choose a site");
			for (const site of sites) dropdown.addOption(site.id, `${site.name} (${site.domain})`);
			if (current && !sites.some((site) => site.id === current)) dropdown.addOption(current, current);
			dropdown.setValue(current);
		} catch {
			// Leave the short list. The check button shows the error.
		}
	}
}
