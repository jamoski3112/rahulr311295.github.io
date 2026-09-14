# rahulr.in — Astro

Personal cybersecurity blog for Rahul R, rebuilt on [Astro](https://astro.build) (replacing the Jekyll / Minimal Mistakes site).

## Commands

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm install`       | Install dependencies                                      |
| `npm run dev`       | Dev server at `http://localhost:4321` (search is disabled) |
| `npm run build`     | Production build into `dist/` + Pagefind search index     |
| `npm run preview`   | Serve `dist/` locally (search works here)                 |
| `npm run htb`       | Refresh the HackTheBox profile snapshot in `src/data/htb.json` |
| `npm run cms`       | Local Decap CMS backend; open `/admin/` on the dev server |
| `npm run convert:jekyll` | Re-import posts from `../rahulr311295.github.io/_posts` |

## Writing a post

Create `src/content/posts/<Slug>.md`. The file name becomes the URL (`/<Slug>/`, case preserved), unless you set `slug:` in the front matter.

```yaml
---
title: "HackTheBox - MachineName"
description: "One paragraph summary shown on cards and in search results."
date: 2026-09-14
teaser: /assets/images/htb-machinename/icon.png   # optional card image
categories: [hackthebox]
tags: [hackthebox, linux, privesc]
draft: false                                       # true = hidden in production
htb:                                               # optional – renders the machine info box
  machine: MachineName
  os: Linux
  difficulty: Medium        # Easy | Medium | Hard | Insane
  points: 30
  ip: 10.10.11.42
  retired: 2026-09-01
  profile: https://app.hackthebox.com/machines/MachineName
  icon: /assets/images/htb-machinename/icon.png
---
```

Images go in `public/assets/images/<slug>/` and are referenced as `/assets/images/<slug>/file.png`, exactly like before.

Fenced blocks tagged `console`, `bash`, `sh`, `shell` or left untagged get the terminal-window chrome; every block gets a language label and a copy button.

## HackTheBox status card

`scripts/fetch-htb.mjs` pulls the public profile (rank, points, owns, machine/challenge progress, Pro Labs, Fortresses) from the HTB API into `src/data/htb.json` before every build. The API is CORS-locked, so this cannot run in the browser. If the fetch fails the committed snapshot is used. The deploy workflow also runs on a daily schedule so the numbers on the live site stay current. Change the user id via the `HTB_USER_ID` env var or the default in the script.

## CMS (Decap)

Decap is git-based, so it works with Astro exactly as it did with Jekyll: it commits markdown into `src/content/posts/` and images into `public/assets/images/<slug>/`. `public/admin/config.yml` already targets those paths.

- **Production**: `https://rahulr.in/admin/` — signs in through the existing GitHub OAuth proxy (`decap-cms-oauth-flax.vercel.app`) and commits to `gh-pages`.
- **Local**: run `npm run dev` and `npm run cms` in two terminals, then open `http://localhost:4321/admin/`. Edits go straight to the working tree with no login.

## Structure

```
src/
  consts.ts            site metadata, nav, social links
  content.config.ts    post schema
  content/posts/       markdown posts
  layouts/             Base, PostLayout, taxonomy layouts
  components/          Header, Footer, Hero, PostCard, HtbInfobox, Toc, Icon
  pages/               index, [slug], posts/, categories/, tags/, search, rss.xml, 404
  styles/              global.css (theme tokens), prose.css (article typography)
public/
  assets/images/       post images (copied from the Jekyll site)
  admin/               Decap CMS (config points at src/content/posts)
  CNAME, robots.txt, favicon.svg
.github/workflows/deploy.yml   GitHub Pages deploy on push to main
```

## Deploying

The workflow builds on every push to `gh-pages` and publishes with GitHub Pages' "GitHub Actions" source. In the repo settings set **Pages → Source → GitHub Actions**. The `CNAME` file keeps the custom domain.

Legacy URLs: post permalinks are unchanged; `/year-archive/` redirects to `/posts/`.
