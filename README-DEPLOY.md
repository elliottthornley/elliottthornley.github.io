# Deploy Repository For elliott-thornley.com

This folder is the **publishing repository** for Elliott Thornley's academic website. It is
pushed to GitHub as `elliottthornley/elliottthornley.github.io`, and GitHub Pages serves its
contents at `https://www.elliott-thornley.com`.

## What This Folder Is Not

This is **not** where you edit the site. It contains only generated output.

The real source lives in `/Users/elliottthornley/academic-website/`:

- Markdown and `.docx` sources, conversion scripts, the writing manifest, and archives.
- Those are deliberately kept out of this repository, so the public repo contains only the
  published site.

Edit there, rebuild, then run the deploy script described below.

## Why A Separate Folder

`academic-website/scripts/build_deploy_bundle.py` deletes and recreates `dist/` on every run
(`shutil.rmtree(DIST)`). If the git repository lived inside `dist/`, every rebuild would destroy
the `.git` directory and the commit history. Keeping the repository here, and copying `dist/`
into it, avoids that.

## Publishing An Update

From `/Users/elliottthornley/academic-website/`:

```sh
python3 scripts/build_writing.py
python3 scripts/build_deploy_bundle.py
python3 scripts/check_launch_readiness.py dist
./scripts/deploy.sh
```

`deploy.sh` copies `dist/` into this folder, restores the `CNAME` file, commits, and pushes.
GitHub Pages redeploys automatically, usually within a minute.

## The CNAME File

`CNAME` contains a single line: `www.elliott-thornley.com`.

GitHub Pages reads this file to know which custom domain the site answers on. It must survive
every deploy — `deploy.sh` rewrites it after each sync, because the sync mirrors `dist/`, which
does not contain a `CNAME` file of its own.

If `CNAME` ever goes missing, the custom domain unbinds and the site reverts to serving at
`elliottthornley.github.io`.

## Canonical Domain

`www.elliott-thornley.com` is canonical. The apex domain `elliott-thornley.com` points at
GitHub Pages' IP addresses and GitHub redirects it to the `www` form. The sitemap, the robots
file, and the `SITE_URL` constant in `build_deploy_bundle.py` all use the `www` form.

## DNS And Rollback

The full cutover and rollback procedure is in
`/Users/elliottthornley/academic-website/LAUNCH_CHECKLIST.md`.

The short version of rollback: point the `www` CNAME record back at `ghs.googlehosted.com` and
the apex A record back at `198.185.159.145`, which restores the old Google Site.
