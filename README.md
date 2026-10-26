# Privatus Analytics for Obsidian

You write your plans, launch notes and weekly reviews in Obsidian. But your website numbers live in another app. So you keep switching tabs and copying numbers by hand, and your notes go out of date.

This plugin puts your [Privatus Analytics](https://privatusanalytics.com) stats right inside your notes. Add a small block to any note and it shows a live card: visitors, pageviews, a small chart, your top pages and where visitors came from. One command also writes a weekly traffic summary into your note as plain Markdown.

Your plans and your results sit side by side. Your weekly review takes seconds, and the numbers stay in your vault for good.

## What you get

- **A live stats card in any note.** It shows visitors, pageviews, bounce rate and visit length, each with the change from the period before. A small chart shows visitors over time, and short lists show top pages, top sources, goals or countries. Press the refresh button for the newest numbers.
- **A weekly traffic summary.** Run **Insert weekly traffic summary** and pick a site. The plugin writes the last 7 full days as Markdown tables: the main numbers and their change, the busiest day, top pages, top sources and goals. It is plain text, so it works in search, links and exports, and it never changes later.
- **A quick way to add a card.** Run **Insert live stats card** and pick a site.

## Set up

1. Install **Privatus Analytics** from **Settings → Community plugins** and turn it on.
2. In Privatus Analytics, open **Workspace settings**, then **API tokens**, and make a token. It starts with `pat_`. No account yet? [Make a free account](https://privatusanalytics.com/users/sign_up).
3. In Obsidian, open **Settings → Privatus Analytics**. Under **API token**, add a new secret and paste the token. Obsidian keeps it in its secret storage, not in a file in your vault.
4. Select **Check** to make sure the token works, then pick a **Default site**.

## The stats card

Add a code block with the language `privatus-analytics`:

````markdown
```privatus-analytics
site: example.com
period: 30d
show: pages, referrers
```
````

Every line is optional. With an empty block, the card uses your default site and default period.

| Line | What it does | Example |
| --- | --- | --- |
| `site` | The site to show, by domain or site ID. | `site: example.com` or `site: pa_AB12CD34EF` |
| `period` | The time range. | `today`, `yesterday`, `7d`, `14d`, `28d`, `30d`, `90d`, `mtd`, `last_month`, `qtd`, `last_quarter`, `ytd`, `12mo`, `last_year`, `all` |
| `from` and `to` | Exact days instead of a period. Use both. | `from: 2026-10-01` and `to: 2026-10-31` |
| `show` | Which lists to show, in order. | `pages, referrers, goals, countries` or `none` |
| `top` | How many rows in each list (0 to 50). | `top: 10` |
| `compare` | Show the change from the period before. | `compare: no` |

Days follow the time zone set on each site in Privatus Analytics.

## Settings

- **API token**: the secret that holds your token.
- **Default site**: used when a card has no `site` line.
- **Default period**: used when a card has no `period` line.
- **Rows in top lists**: how many rows lists show by default.
- **Keep numbers for (minutes)**: cards reuse numbers for this long, so opening a note again does not ask the server again. The refresh button always gets fresh numbers.

## Network use and privacy

- The plugin talks to one place only: `https://privatusanalytics.com`, the Privatus Analytics API. It sends your API token with each request.
- It only reads data. It cannot change or delete anything in your account.
- It asks for numbers when a note with a card is shown, when you select refresh or **Check**, and when you run one of its commands.
- It sends nothing from your vault. No note text, file names or other data leave your device.
- It has no tracking and no ads.
- You need a Privatus Analytics account. There is a free plan. Paid plans add more sites and keep your numbers for longer.

## Help

Open an issue at https://github.com/Privatus-Analytics/obsidian-privatus-analytics/issues or write to hello@privatusanalytics.com.

## Development

```sh
npm install
npm run dev     # rebuild main.js on every change
npm run build   # type check and production build
npm run lint    # eslint with eslint-plugin-obsidianmd
npm test        # unit tests for the parser and formatters
PRIVATUS_TOKEN=pat_... node test/live.mjs example.com   # calls the live API
```

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/privatus-analytics/` to try a build.

## License

MIT
