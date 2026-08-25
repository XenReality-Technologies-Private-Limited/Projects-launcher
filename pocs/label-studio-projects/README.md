# Label Studio Project Registry

`index.html` is a static, generated page — two tabs: **Retail (CE/MFC)** and **All / by vertical**.
It's a snapshot of `label.xenreality.com` at the time it was last built. Nothing on this branch
ever writes back to Label Studio — every fetch is a read-only `GET`.

## Regenerating it

```
LS_URL=https://label.xenreality.com \
LS_BASIC_USER=... LS_BASIC_PASS=... \
LS_EMAIL=... LS_PASS=... \
python3 build_registry.py
```

This re-fetches every project from Label Studio, re-sorts them using `group_rules.json`, and
rewrites `index.html` from `index_template.html`. Credentials are never hardcoded or committed —
pass them as environment variables (e.g. from a secrets manager or CI secret store) each time.

If the fetch comes back with an implausibly small number of projects (a flaky server, a partial
response), the script aborts without touching the existing `index.html` or `ls_projects_dump.json`.

## Adding a new group

Grouping rules live in `group_rules.json`, not in the script. Each vertical is checked top to
bottom; the first match wins. A project that matches nothing falls into "Uncategorized / needs
manual review" automatically.

- **New Retail customer**: add an entry under `verticals[0].customers` with a list of regex
  patterns matched against the (lowercased) project title.
- **New bucket in an existing vertical** (e.g. another Cafe category): add an object to that
  vertical's `buckets` list with a `name` and `patterns`.
- **Entirely new vertical**: append a new object to the `verticals` array, `kind: "bucketed"`,
  with its own `buckets` list.

After editing `group_rules.json`, re-run `build_registry.py` to apply it — previously
uncategorized (or differently-categorized) projects will move automatically.

## Files

- `index.html` — the built page (what gets hosted).
- `index_template.html` — the page shell/JS; data gets injected into it at build time.
- `group_rules.json` — editable categorization rules.
- `build_registry.py` — fetch → categorize → render pipeline.
- `verticals.html` — redirect stub (this used to be a separate page; it's now the "All" tab).
