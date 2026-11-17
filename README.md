![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/FadliAR/gta6-01-open-world/rank.svg)
![reward](https://make.fun/badge/gta6-01/FadliAR/gta6-01-open-world/reward.svg)

# NEON HARBOR — an original open-world crime game

[Play the bounty on make.fun](https://make.fun/c/gta6-01)

One courier. One city. Three jobs before sunrise. **Neon Harbor** is a complete
open-world crime game that runs offline in desktop Chrome from static files:
walk the streets, steal cars, dodge the Harbor PD, and finish all three jobs
to become a Harbor Legend.

## What is in the city

- **A living open world** — 49 intersections, a downtown of towers, a central
  plaza with the Harbor Spire, parks, a marina and a working dock with a pier
  over the water. Traffic drives the road graph; pedestrians walk the
  sidewalks, idle at corners and flee from trouble.
- **On foot and behind the wheel** — third-person on-foot movement with run,
  jump and punch; arcade driving with steering, handbrake drifts, building
  and traffic collisions. Press **E** to steal any parked car.
- **Wanted system** — crimes raise your stars; foot cops chase you down and
  police cars hunt you on the roads. Get caught and you are BUSTED; get hurt
  and you are WASTED. Lay low and the heat decays.
- **Three chained missions** — Harbor Pickup, Hot Wheels and the Spire Run —
  with beacons in the world, minimap blips and a HUD objective line, plus
  cash pickups scattered around the city.
- **Feel and polish** — trauma-based camera shake, hit-stop on punches and
  crashes, particles, a live minimap, speedometer, health and wanted HUD,
  synthesized engine and siren audio (Web Audio, no audio files), title,
  pause, busted, wasted and completion screens.

## How to play

Open `game/index.html` in desktop Chrome. No server, no network, no install.

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse drag | Look around (orbit camera) |
| Mouse wheel | Zoom camera |
| SHIFT | Run |
| SPACE | Jump / handbrake while driving |
| F | Punch |
| E | Enter or exit a car |
| M | Mute |
| ESC | Pause |

## Structure

- `game/index.html` — page shell, HUD and menus
- `game/css/style.css` — HUD and menu styling
- `game/js/config.js` — every tuning number in one place
- `game/js/rng.js` — seeded PRNG (same seed, same city)
- `game/js/city.js` — streets, blocks, buildings, docks, road graph
- `game/js/vehicles.js` — car factory and traffic AI
- `game/js/pedestrians.js` — pedestrian FSM (walk, idle, flee)
- `game/js/player.js` — on-foot movement and combat
- `game/js/driving.js` — arcade car physics and enter/exit
- `game/js/police.js` — wanted stars, foot cops, police cars
- `game/js/missions.js` — the three-job chain and cash pickups
- `game/js/hud.js` — HUD and canvas minimap
- `game/js/audio.js` — synthesized sound (Web Audio)
- `game/js/effects.js` — particles, camera shake, hit-stop
- `game/js/camera.js` — third-person follow/orbit camera
- `game/js/main.js` — bootstrap, game loop, crime rules
- `game/vendor/three.min.js` — vendored three.js (MIT)
- `main.ts` — copies `game/` + `screenshots/` to the output and writes
  `dossier.json` with the kit's `vendor/makefun-game.ts`

## Originality

Neon Harbor is fiction: an original city, original characters and an original
story. It uses no Rockstar names, assets or likenesses. three.js is vendored
under `game/vendor/` under its MIT license; everything else was written for
this entry.
