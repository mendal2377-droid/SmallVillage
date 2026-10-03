# Wandering systems — 4 October 2026

This supersedes the two-button entry documented in the historical connected-world notes. The actual full village model loads as a 3D plan at startup, with five projected entry pins. Every entry uses the same geometry and navigation; the owner's yard, stairs and balcony remain continuously accessible. The Summer night buttons in the overview and walking menu set clear weather, summer, 22:00 and fixed time. They do not teleport the player.

## Modules and contracts

| Module | Responsibility |
| --- | --- |
| `src/places.js` | Five map landmarks, six garden footprints, eight activity locations |
| `src/map.js` | Projected 3D entry pins; north-up minimap drawn from actual field/water/collider metadata; position arrow, selected destination and distance |
| `src/game/adventure.js` | Energy and activity state, cooldowns, prompts, fishing/roasting/kite/firework props and effects |
| `src/gardens.js` | Curved vegetable plants, produce, spreading trees/orchard, softer banks, flowers, fish and fireflies |
| `src/organic.js` | Curved leaf/tube/ellipsoid geometry and batching helpers |
| `src/game/creatures.js` | Seven animal types including rabbits; varied scale, pace, roam range and pauses; chicken flight retained |
| `src/environment.js` | Individual star phases/brightness/size, night visibility and sky/weather |

Map selection guides direction and distance; it is not an automatic route planner. It never jumps the player between places. In the overview only, pins choose an initial spawn. The small map can expand; click/tap a landmark or the home icon. North is negative world Z, consistent with the assumed sketch orientation. Original mapped poplar/trunk and field positions remain anchored to the reconstruction; the new decorative gardens/trees and activity sites are interpretation, not evidence of actual crops at those coordinates.

## Energy and activities

Energy starts at 100 per page session, drains by 0.075 points/second during ordinary wandering (0.1 when running/chicken flight), and warns at 25. A single reminder selects home on the map; the persistent HUD reminder remains while low. Warnings re-arm after energy rises above 35. At zero the player can still move and return home. The current home envelope includes the yard/rooms/upstairs: X between -37.8 and -23.5, Z between 99 and 122.5, camera Y below 8. Recovery is 6 points/second, capped at 100. The overview, settings menu and hidden browser tab pause energy and activity progression. Clicking Overview is not equivalent to resting in the physical house.

Nearby available encounters are sampled randomly. Declining suppresses that site for 45 seconds; finishing/failing uses a random 90–150 second cooldown. Q acts; X leaves. The same actions have touch buttons. Tasks pause energy drain; successful tasks restore energy:

| Activity | Interaction | Energy |
| --- | --- | --- |
| Fishing | Cast, wait 3–7 seconds, Q during a 2.8 second bite window (extended on slow frames); random named regional fish catch, released | +16 |
| Potato roasting | 12 second cook; turn twice at least two seconds apart | +26 turned / +14 otherwise |
| Watermelon | Approach an actual ripe striped fruit within 1.8 m, Q picks; fruit regrows after 150 seconds | +22 |
| Rabbit | Follow the fleeing/hopping rabbit, Q within 1.7 m; catch briefly and release | +12 |
| Kite | Pull three times at least one second apart, keep it airborne for 12 seconds | +10 |
| Firework | Night-only rising rocket and coloured particle burst | +10 |

Watermelons are available in summer/autumn; fishing pauses in winter/ice; wet weather disables campfire/kite/fireworks; fireworks require dark conditions. A live weather/season change cancels incompatible tasks without a reward. Walking too far away or waiting too long cancels; riding/flying cancels an active task. The player retains normal walking/look input during activities. Timers/energy use active elapsed time, separately from capped movement physics. A newly revealed bite is guaranteed a window; low frame rate extends it up to 20 seconds. Visibility resumes with a fresh clock, so a hidden tab cannot consume energy. These are fictional game interactions, not simulations of real harvesting, fishing or animal handling.

## Geometry and seasonal appearance

Garden models have curved cupped leaves, branching stems, low sprawling vines, solid striped watermelons, cabbage heads, potato foliage/flowers, tomato/pepper fruit and cucumber trellises. Grain placements have uneven spacing, missing plants and broad growth gaps. Original crop stand cutouts remain a distance optimisation; near plants have curved geometry. Big trees use irregular forked branches, many instanced curved leaves and seasonal bare crowns. The five orchard trees include peach, pear and apple: spring blossoms, summer peaches and autumn pears/apples. Winter gardens mostly rest except cabbages; spring growth is shorter; warm seasons show produce. The pond has raised circular cupped lotus leaves/flowers; winter fish and tender plants are hidden. Fireflies appear on dry summer nights. Fish use five representative types with fins, tails and swimming paths: crucian/common/grass/silver carp and catfish. Water is a translucent light-green flowing shader; the original ground/bank faces inside water are clipped so submerged fish remain visible. No fluid volume, measured water quality or true geometry reflection is simulated.

## Research consulted 4 October 2026

These establish regional plausibility or plant morphology; none identifies a species or crop in the owner's village. No third-party texture/model assets are downloaded.

- [Zhoukou government: Fugou vegetable industry](https://www.zhoukou.gov.cn/page_pc/ztzl/2023nztzl/jsnyqs/jsnyqsclnypp/article41648c6f9b6345328a02ccf60e3ee2f3.html), 13 June 2023: regional cucumber, tomato, pepper, eggplant, broccoli and watermelon production supports mixed vegetable gardens.
- [Henan Academy of Agricultural Sciences: straw-covered potato cultivation](https://www.hnagri.org.cn/article-983.html): potato foliage and tuber crop chosen at the owner's request; not a claim of village prevalence.
- [National Forestry and Grassland Administration: paulownia](https://www.forestry.gov.cn/c/www/sl/657169.jhtml), 16 January 2026: widespread Henan planting and large mature size inform broad-crowned trees. Other generic mature willow/scholar-tree forms are decorative interpretations.
- [Henan Academy of Agricultural Sciences: 2025 spring fruit-tree management](https://www.hnagri.org.cn/article-109532.html), 4 March 2025: peach, pear and apple flower/fruit management informs the mixed orchard and spring blossom stage. The game's ripening windows are simplified.
- [Henan Academy of Agricultural Sciences: common fish culture](https://www.hnagri.org.cn/article-2487.html): regional carp/grass carp/crucian and silver/bighead carp aquaculture. Additional catfish are a representative gameplay variety, not a verified population at this site.
- [Beijing Forestry and Parks: lotus and water lilies](https://yllhj.beijing.gov.cn/ztxx/bjhx/hhzs/202209/t20220907_2810688.shtml), 30 August 2022: lotus leaves and flowers stand above water; the model follows this shape rather than treating lotus as floating lily pads.

## Validation

`test:adventure` covers energy alert/recovery/cap, all six completions, missed bites, cooldown, season cancellation, slow rendering and menu pause. Existing walking/stairs, environment and vehicle/toy checks remain applicable. `npm test` exercises 3D entry pins, night preset, minimap/energy, connected house, chicken flight, live settings and renderer reuse; development mode additionally checks fishing and low-energy/home recovery, and captures garden/water/night views. `test:touch` checks mobile pins, minimap expansion, actual touch arrows/look, live winter/snow tools and the walking Summer night button. `test:activities` is a development-server check of summer vegetables, spring orchard blossoms, live fish, fishing, kite and night fireworks, with close-up captures. Evidence is ignored under `artifacts/world/`.

No saved progress/backend is introduced. New vegetation/ecology/activity props live in browser code; they are not added to the saved Blender architecture. Keep `places.js` aligned with exported navigation when moving landmarks. Most surrounding homes remain exterior-only. Exact species, cultivar, dimensions and placement are estimated. Full disposal, scanned materials, lower-end graphics quality settings and route planning remain potential future work.
