# Create Collection — deployment

Three pieces: the UI (already built by the nightly workflow), a backend
container, and one nginx route so the browser can reach it.

---

## 1. Permissions (only needed for `symlink` mode)

Required for the default `symlink` mode. `reference` mode needs none of it.

Symlink mode writes into a folder inside `navneet`'s home, so the service user
needs to reach it. These are surgical: traverse only on the parents (the same
grant `sidd` already has), read on the dataset, write on one new folder.

```bash
# walk into the tree — traverse only, cannot list navneet's other files
sudo setfacl -m u:vaibhav:--x /home/navneet /home/navneet/Documents

# read + enter directories, so created links can be verified as resolving
sudo setfacl -R -m u:vaibhav:rX /home/navneet/Documents/polaris_data_labelling

# the collections folder itself
sudo mkdir -p /home/navneet/Documents/polaris_data_labelling/_collections
sudo chown vaibhav:polaris /home/navneet/Documents/polaris_data_labelling/_collections
sudo chmod 2775 /home/navneet/Documents/polaris_data_labelling/_collections
```

Verify:

```bash
R=/home/navneet/Documents/polaris_data_labelling
touch $R/_collections/.probe && echo "WRITE OK" && rm $R/_collections/.probe
ls $R/sam_dataset | head -3
```

Step 2 grants read on the whole labelling dataset — it lives in navneet's home,
so worth telling him rather than doing it silently.

---

## 2. The backend container

The Label Studio compose file lives at
`/home/xen/Documents/LabelStudio/docker-compose.yml` (services: `db`, `app`,
`nginx`). Back it up before editing - a syntax error there takes Label Studio
down for everyone:

```bash
sudo cp /home/xen/Documents/LabelStudio/docker-compose.yml{,.bak}
sudo git clone -b label-studio-projects <repo-url> /opt/ls-collection
```

Then paste the `collection-api` service from
`docker-compose.collection-api.yml` into it.

The Label Studio service is `app` (confirmed), so `LS_URL: http://app:8080`
is correct as written.

Put the Label Studio account credentials in the compose project's `.env`:

```
LS_EMAIL=vaibhav@xenreality.com
LS_PASS=...
```

Then:

```bash
C=/home/xen/Documents/LabelStudio/docker-compose.yml

sudo docker compose -f $C config >/dev/null && echo "compose file OK"   # validate first
sudo docker compose -f $C up -d --build collection-api
curl localhost:8800/api/collections/health          # {"ok":true,...}
```

No `LS_BASIC_USER` / `LS_BASIC_PASS` needed — on the compose network the backend
talks to Label Studio directly, with no openresty in between.

---

## 3. The nginx route (AWS)

The UI calls `/api/collections` as a **relative** path, so it must be served from
the same origin as the page. On the openresty config for
`xentrack.xenreality.com`:

```nginx
location /api/collections {
    proxy_pass http://<zeus-vpn-ip>:8800;
    proxy_set_header Host $host;
    proxy_read_timeout 600s;      # a large collection takes minutes
}
```

Same pattern as the existing `label.xenreality.com` → zeus:8080 forward.

Without this the button 404s; nothing else matters until it exists.

---

## 4. Push the UI

Edit `index_template.html` — never `index.html`, which the bot regenerates
nightly and would overwrite.

```bash
git add index_template.html build_registry.py collection_api.py \
        requirements-api.txt Dockerfile.collection-api \
        docker-compose.collection-api.yml DEPLOY.md
git commit -m "Add create-collection tab and backend"
git pull --rebase && git push
```

Then GitHub → Actions → *Refresh Label Studio project registry* → **Run workflow**
to regenerate `index.html` immediately instead of waiting for 03:00 UTC.

---

## Modes

`symlink` (default, verified end-to-end)
: Gathers the chosen images into `_collections/<name>/` as relative symlinks and
  attaches that one folder as a single storage. **Exact counts** - whole projects
  are taken while they fit, then the last one is sliced to land on the number
  requested. Needs step 1. Verified: Label Studio follows the links both when
  syncing and when serving images.

`reference` (opt-in, also proven)
: Attaches each source folder to the new project as its own storage. Writes
  nothing to disk. Count overshoots to whole-project boundaries — a request for
  20,000 gave 21,035 in testing. Trim extras in the Data Manager if it matters;
  deleting a task never touches the file or the source project.

Pass `"mode": "reference"` in the request body to switch.

---

## Testing without the browser

```bash
curl -X POST localhost:8800/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"probe","count":500,"dry_run":true,
       "selections":[{"group":"EasyBuy","project_ids":[195,196,197]}]}'
```

`dry_run` computes the whole plan and creates nothing. Use it freely.
