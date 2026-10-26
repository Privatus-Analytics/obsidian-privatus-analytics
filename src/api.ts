import { requestUrl } from "obsidian";
import type { Overview } from "./format";

export const BASE_URL = "https://privatusanalytics.com";

export interface Site {
	id: string;
	workspace_id: string;
	domain: string;
	name: string;
	timezone?: string;
}

interface Workspace {
	id: string;
	name: string;
}

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export interface OverviewQuery {
	period: string;
	from?: string;
	to?: string;
	compare: boolean;
}

/** A small client for the read-only parts of the Privatus Analytics API. */
export class PrivatusClient {
	private sitesCache: { at: number; sites: Site[] } | null = null;
	private overviewCache = new Map<string, { at: number; data: Overview }>();

	constructor(
		private readonly getToken: () => string | null,
		private readonly cacheMinutes: () => number,
	) {}

	clearCache(): void {
		this.sitesCache = null;
		this.overviewCache.clear();
	}

	private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
		const token = this.getToken();
		if (!token) {
			throw new ApiError("Add your API token in the plugin settings first.", 0);
		}
		const query = new URLSearchParams(params).toString();
		const url = `${BASE_URL}${path}${query ? `?${query}` : ""}`;
		const response = await requestUrl({
			url,
			method: "GET",
			headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
			throw: false,
		});

		if (response.status >= 200 && response.status < 300) {
			return (response.json as { data: T }).data;
		}

		let message = `Privatus Analytics replied with status ${response.status}.`;
		try {
			const body = response.json as { error?: { message?: string } } | undefined;
			if (body?.error?.message) message = body.error.message;
		} catch {
			// The body was not JSON. Keep the status message.
		}
		if (response.status === 401) {
			message = `${message} Check the API token in the plugin settings.`;
		} else if (response.status === 429) {
			message = "Too many requests this hour. Try again in a few minutes.";
		}
		throw new ApiError(message, response.status);
	}

	/** Every site the token can read. A token belongs to one workspace. */
	async listSites(force = false): Promise<Site[]> {
		const ttl = this.cacheMinutes() * 60_000;
		if (!force && this.sitesCache && Date.now() - this.sitesCache.at < ttl) {
			return this.sitesCache.sites;
		}
		const workspaces = await this.get<Workspace[]>("/workspaces.json");
		const sites: Site[] = [];
		for (const workspace of workspaces) {
			for (let page = 1; page <= 20; page++) {
				const batch = await this.get<Site[]>(`/workspaces/${encodeURIComponent(workspace.id)}/sites.json`, {
					page: String(page),
					per_page: "100",
				});
				sites.push(...batch);
				if (batch.length < 100) break;
			}
		}
		this.sitesCache = { at: Date.now(), sites };
		return sites;
	}

	/** Finds a site by ID (pa_...) or by domain. */
	async findSite(idOrDomain: string): Promise<Site> {
		const wanted = idOrDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
		const sites = await this.listSites();
		const site =
			sites.find((s) => s.id.toLowerCase() === wanted) ??
			sites.find((s) => s.domain.toLowerCase() === wanted) ??
			sites.find((s) => s.domain.toLowerCase() === wanted.replace(/^www\./, ""));
		if (!site) {
			throw new ApiError(`No site "${idOrDomain}" in this workspace. Use a site ID like pa_AB12CD34EF or a domain.`, 404);
		}
		return site;
	}

	async overview(siteId: string, query: OverviewQuery, force = false): Promise<Overview> {
		const params: Record<string, string> = { period: query.period };
		if (query.period === "custom" && query.from && query.to) {
			params.from = query.from;
			params.to = query.to;
		}
		if (query.compare) params.compare = "previous_period";

		const key = `${siteId}?${new URLSearchParams(params).toString()}`;
		const ttl = this.cacheMinutes() * 60_000;
		const cached = this.overviewCache.get(key);
		if (!force && cached && Date.now() - cached.at < ttl) return cached.data;

		const data = await this.get<Overview>(`/sites/${encodeURIComponent(siteId)}/overview.json`, params);
		this.overviewCache.set(key, { at: Date.now(), data });
		return data;
	}
}
