# Upstairs controls, photo sunset and activity wayfinding

4 October 2026 follow-up to the painted woodland release.

## Player controls

- Drag to look by default. **C** levels the camera; the settings menu includes look sensitivity and optional mouse capture.
- Upstairs and on stair ramps, walk at 1.15 m/s, with reduced look sensitivity and no running boost. Ground routes retain 2 m/s walking and 3.8 m/s running.
- Logical feet follow the exported ramp/floor independently of the eye, which eases toward its height. Collision continues to use the actual floor, so smoothing cannot make a landing inaccessible.
- A single cream chicken follows the player across the village, upstairs and onto the terrace. **E** or **Fly** summons this companion anywhere; Space/flap rises, Ctrl/descend lowers, E/Land requests a safe landing. Existing floor, ceiling, water and bounds rules still apply.
- **F** prioritizes a nearby vehicle. Without mouse capture, right mouse uses a tool; captured left mouse retains its previous behavior. Touch tool and flight buttons remain available.

## Photos and source

Sunset uses a quieter slate-blue upper sky, peach/orange horizon, sparse wisps, a low visible sun with a broad glow and lower ambient light. It remains an illustrated interpretation of the supplied snowy-roof and field photographs. The sunset preset fixes time at 18.15; the ordinary day/night cycle is retained.

The red storage-room door beside the blue shed is closed and faces the yard in the editable Blender source, with raised panels, a handle and festival decoration beneath the retained transom. `blender/correct_storage_door.py` is additive and idempotent against the current saved scene. It removes the old perpendicular open leaf without restoring historical backups.

Three dedicated `Photo storage door` materials keep the leaf separate through export batching. `src/house-door.js` uses material names because the glTF loader sanitizes mesh names. It swings the leaf inward on approach and supplies a height-aware closed-door collider. The old static leaf collider is removed in the regenerated navigation. Both GLBs and the editable `.blend` are committed together.

## Activity map

The small overview map appears on the main plan and while walking. Nine activity sites have colored symbols, with six activity buttons in the main plan and expanded walking map. Choosing one highlights its destination, direction and distance; on the main plan it also displays a clickable 3D entry pin. Entry coordinates are searched on clear ground near the activity, avoiding water and colliders. Dim buttons/icons indicate seasonal, weather or night restrictions; desktop tooltips explain them. Existing activity availability and encounter rules remain unchanged.

The expanded map is above activity prompts; settings are above the expanded map. The phone flight button sits below the energy display, clear of activity prompts and movement buttons.

## Checks

```sh
npm run test:comfort        # Ramp/eye behavior, look, safe activity entries, companion, photo door
npm run test:comfort-ui     # Desktop activity entry, flight, controls, door, upstairs, vehicle, sunset
npm run test:comfort-touch  # Phone map, flight button, settings, actual touch movement/look
npm run test:stairs
npm run test:walk
npm run test:environment
npm run test:game
npm run test:adventure
npm run build
```

Browser checks use a development server on port 4173, or `BASE_URL`. Development mode adds scene/door audits and screenshots; production checks use visible UI and published state. Evidence is ignored under `artifacts/comfort/`. Software WebGL checks behavior and appearance, not hardware frame rate.

Local release checks passed: comfort controller/desktop/phone, full stairs and connected routes, environment, vehicles/toys, all activity controllers, woodland route/planting and production build. The final sunset adjustment also rendered without JavaScript or shader errors and was reviewed against the supplied photographs.
