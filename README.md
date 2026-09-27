# zune player

A tribute to the Microsoft Zune (Zune 30, Zune 80/120 and Zune HD) that streams your Spotify library.
Switch devices and colors from the panel beside the player. Until you connect Spotify, it runs in a
demo mode with a fictional library and simulated playback.

## Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (not `localhost`. Spotify only accepts the loopback IP for local redirect URIs).

Live: **https://bransonwerner.github.io/zune-player/**

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
You can also re-run it from the repo's **Actions** tab (**Deploy to GitHub Pages** → **Run workflow**).

## Connect Spotify

1. Go to <https://developer.spotify.com/dashboard> → **Create app**.
2. Redirect URIs: `https://bransonwerner.github.io/zune-player/` (live site) and `http://127.0.0.1:5173/` (local dev)
3. APIs used: tick **Web API** and **Web Playback SDK**. Save.
4. **User Management**: add the email of every Spotify account that will sign in (development-mode apps are allowlist-only).
5. Copy the **Client ID** into the panel beside the device (or put it in `.env` as `VITE_SPOTIFY_CLIENT_ID`).
6. Click **sign in with spotify**.

Playback needs **Spotify Premium** and a desktop browser (Chrome, Edge, Firefox). The browser tab shows up
in Spotify Connect as a device named "Zune".

## Controls

| Key | Action |
| --- | --- |
| ↑ ↓ ← → | Zune Pad / d-pad |
| Enter | select |
| Esc / Backspace | back (hold the device's back button for home) |
| Space | play / pause |
| + / − | volume |
| M | Zune HD media button |

On the Zune 80, drag on the squircle pad to scroll and click its edges to move. On the Zune HD, tap and swipe the screen.

## Layout

- `src/devices/`: the physical shells and their buttons (emit actions on the input bus)
- `src/os/classic/`: Zune firmware UI (Zune 30, 80/120)
- `src/os/hd/`: Zune HD UI
- `src/library/`: Spotify and demo libraries behind one interface
- `src/playback/`: Spotify Web Playback SDK and simulated demo player
- `src/spotify/`: PKCE auth and API client

Fan-made; not affiliated with Microsoft or Spotify.
