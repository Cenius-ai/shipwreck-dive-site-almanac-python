# Install and run

Nothing here installs a system package, starts a service or needs a network connection. The
only prerequisite is Python 3.8+ (`python3` on the `PATH`). There is no `requirements.txt`,
no `package.json` and no compile step: the product is static files served by the Python
standard library.

## 1. Install

```sh
sh install.sh
```

The script:

1. checks that `python3` exists and is at least 3.8;
2. validates `data.json` (valid JSON, `schemaVersion: 1`, at least one site);
3. runs the verification suite (`python3 -m unittest discover -s tests -t .`).

It exits without starting a server. Re-running it is safe.

## 2. Seed

Nothing to seed. `data.json` in the repository root **is** the seed: six wreck sites, one tide
reference day and eight pre-dive checklist items ship with the repo, so every page renders real
content the first time it is opened.

## 3. Run in dev (or anywhere)

```sh
sh serve.sh
```

Equivalent to:

```sh
python3 -m http.server "${PORT:-8000}" --bind 0.0.0.0
```

Open <http://localhost:8000/>. `PORT` is honoured (`PORT=9000 sh serve.sh`). The server binds
`0.0.0.0`, so it also works from another machine or inside a container port map.

Any other static server works too, as long as it serves the repository root: every route is a
real file with an optional query string.

## 4. Demo sign-in

The dive log sits behind a local demo gate. The credential is printed on the sign-in card:

| Email | Role | Password |
| --- | --- | --- |
| cenius@cenius.ai | Diver (demo) | cenius |

Any diver name works as the identity; the passphrase is always `cenius`. The check happens in
the browser and only the resulting name and certification are written to `localStorage`
(`sda.session.v1`). There is no server, no cookie and no account.

## 5. Verify

```sh
python3 -m unittest discover -s tests -t .
```

Expected: all tests pass, standard library only.
