# Africa Energy Software Atlas

An open, visual map of **software and companies** across Africa’s energy value chain.

This is a from-scratch rebuild of the public interface for [Africa Energy Software Map](https://map.kaykluz.com). The original research, taxonomy and reviewed dataset live in [`kaykluz/africa-energy-software-map`](https://github.com/kaykluz/africa-energy-software-map).

## What it is

One atlas. Four views of the same records.

| View | Question it answers |
| --- | --- |
| **Map** | Where are companies and named software locations? |
| **Chain** | What software sits at this stage of the energy system? |
| **Software** | What products exist, and which are reviewed? |
| **Companies** | Who plays in the sector, and where? |

Click a country, a stage, a product or a company. Every object links to the others. Reviewed records (blue dot) carry sourced deployments. Catalogue coverage is labelled, not dressed up as evidence. Africa-wide tags are **not** painted onto every country.

Anyone can [contribute](https://map.kaykluz.com/contribute) a product, company or correction. Editors sign in at `/login` and review the queue at `/review` before publication. No paid ranking or paid inclusion.

This rebuild now includes that private editor workspace: allowlisted reviewers can accept, hold or reject submissions, and accepted records can appear on the public map.

## Data in this release

- 528 software records (94 reviewed in depth)
- 2,265 companies across the energy ecosystem
- 20 evidenced deployments
- 6 value-chain stages from plan to trade

Dataset licence: [CC BY 4.0](https://github.com/kaykluz/africa-energy-software-map/blob/main/DATA-LICENSE.md). Third-party sources keep their original rights.

## Project

- Live map: [map.kaykluz.com](https://map.kaykluz.com)
- Hosting: Cloudflare Pages + D1 (see Deploying below)
- Notes: [kaykluz.com](https://kaykluz.com)
- Source dataset: [africa-energy-software-map](https://github.com/kaykluz/africa-energy-software-map)

## Running it

Requires Node 22.13+.

```bash
npm install
npm run dev          # http://localhost:8080
```

`vite dev` has no Cloudflare bindings, so the app falls back to a local SQLite
file at `.data/atlas.sqlite` (via `node:sqlite`). Same dialect as production,
so schema behaviour matches. Delete the file to start clean.

With no `REVIEWER_EMAILS` set, that local database lets any signed-in account
open `/review` — deliberately, so the workspace can be tried without putting
secrets in the repo. The deployed database never does this: an empty allowlist
there admits nobody.

To run the real Cloudflare build locally, build first and use wrangler:

```bash
npm run build
npm run pages:dev        # http://localhost:8788, with a local D1
```

## Deploying

The app deploys to **Cloudflare Pages**, built by Nitro's `cloudflare-pages`
preset. The root `wrangler.jsonc` is merged into the generated deploy config.

Pages rather than Workers for one specific reason: a Pages custom domain on a
**subdomain** does not require the domain to be a Cloudflare zone. A Workers
Custom Domain does — it would mean moving the whole domain's nameservers to
Cloudflare, dragging the apex, MX and SPF records along with it. On Pages the
domain stays wherever its DNS already lives and only one CNAME record changes.

(`NITRO_PRESET=cloudflare-module npm run build` still produces a Worker, if the
zone ever does move to Cloudflare.)

**1. Create the database** and paste the returned id into `wrangler.jsonc`:

```bash
npx wrangler d1 create africa-energy-atlas
```

Migrations in `migrations/*.sql` are applied automatically on the first request
after a deploy, so there is no separate migrate step.

**2. Deploy**, which creates the Pages project on first run:

```bash
npm run deploy
```

**3. Bind D1 and set the secrets** on the project (Cloudflare dashboard →
Workers & Pages → your project → Settings), or from the CLI:

```bash
npx wrangler pages secret put BETTER_AUTH_SECRET     # openssl rand -hex 32
npx wrangler pages secret put BETTER_AUTH_URL        # https://map.example.org
npx wrangler pages secret put GOOGLE_CLIENT_ID
npx wrangler pages secret put GOOGLE_CLIENT_SECRET
npx wrangler pages secret put RESEND_API_KEY
npx wrangler pages secret put EMAIL_FROM
npx wrangler pages secret put REVIEWER_EMAILS        # comma-separated
```

Note `wrangler pages secret`, not `wrangler secret` — that one is for Workers.
Bind the D1 database as `DB` under Settings → Bindings.

See `.dev.vars.example` for what each value is. Google and Resend are
independent: configure either and that sign-in method appears; configure
neither and `/login` says so rather than showing a button that cannot work.

In the Google Cloud console, the OAuth client's authorised redirect URI must be
`BETTER_AUTH_URL` followed by `/api/auth/callback/google`.

**4. Attach the custom domain.** In the Pages project → Custom domains → Set up
a custom domain, enter the subdomain (e.g. `map.example.org`). Cloudflare shows
the CNAME target; add it at whatever DNS provider holds the zone:

```
map    CNAME    <your-project>.pages.dev
```

Only that one record changes — the apex, MX and TXT records are untouched. The
dashboard step is required: adding the CNAME alone, without registering the
domain in Pages, returns a 522.

Finally set `BETTER_AUTH_URL` to the custom hostname, add the matching Google
redirect URI, and redeploy. `BETTER_AUTH_URL` must match the final public
hostname, or sign-in fails the origin check rather than silently half-working.

## Editor access

`/review` is the private workspace. It is not linked from the map, search,
footer or contribute form, and is `noindex`.

- Sign in with **Google**, or with an emailed **magic link** (single use,
  expires in 15 minutes).
- Only addresses in `REVIEWER_EMAILS` get in. That list lives in the Cloudflare
  environment, never in this repository — cloning the source cannot open the
  live workspace.
- Magic links are only *sent* to allowlisted addresses, so the form cannot be
  used to mail strangers. It reports success either way, so it cannot be used to
  test who is an editor.
- Email/password is disabled outright, so nobody can register an account on an
  allowlisted address.

Public contribution stays anonymous: honeypot, hashed-IP rate limit, same-site
requests only, public http(s) URLs only. Submissions land as `received`, and
there is no public read, update or delete of the queue.
