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
- Hosting: Cloudflare Workers + D1 (see Deploying below)
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

To run the real Worker locally, build first and use wrangler:

```bash
npm run build
npx wrangler dev --local --config .output/server/wrangler.json
```

## Deploying

The app is a Cloudflare Worker. Nitro's `cloudflare-module` preset builds it and
merges the root `wrangler.jsonc` into the generated deploy config.

**1. Create the database** and paste the returned id into `wrangler.jsonc`:

```bash
npx wrangler d1 create africa-energy-atlas
```

Migrations in `migrations/*.sql` are applied automatically on the first request
after a deploy, so there is no separate migrate step.

**2. Set the secrets:**

```bash
npx wrangler secret put BETTER_AUTH_SECRET     # openssl rand -hex 32
npx wrangler secret put BETTER_AUTH_URL        # https://map.example.org
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put REVIEWER_EMAILS        # comma-separated
```

See `.dev.vars.example` for what each one is. Google and Resend are independent:
configure either and that sign-in method appears; configure neither and `/login`
says so rather than showing a button that cannot work.

In the Google Cloud console, the OAuth client's authorised redirect URI must be
`<BETTER_AUTH_URL>/api/auth/callback/google`.

**3. Deploy**, then attach the custom domain in the Cloudflare dashboard
(Workers → your worker → Settings → Domains & Routes):

```bash
npm run deploy
```

`BETTER_AUTH_URL` must match the final public hostname. If it doesn't, sign-in
fails the origin check rather than silently half-working.

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
