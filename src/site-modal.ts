import { App, FuzzySuggestModal } from "obsidian";
import type { Site } from "./api";

/** Lets the user pick one of their sites by name or domain. */
export class SiteSuggestModal extends FuzzySuggestModal<Site> {
	constructor(
		app: App,
		private readonly sites: Site[],
		private readonly onPick: (site: Site) => void,
	) {
		super(app);
		this.setPlaceholder("Type a site name or domain");
	}

	getItems(): Site[] {
		return this.sites;
	}

	getItemText(site: Site): string {
		return site.name && site.name !== site.domain ? `${site.name} (${site.domain})` : site.domain;
	}

	onChooseItem(site: Site): void {
		this.onPick(site);
	}
}
