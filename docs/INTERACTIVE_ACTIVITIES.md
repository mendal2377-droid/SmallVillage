# Interactive village activities

The activities now ask the player to read movement, timing and feedback instead of completing a fixed number of presses. The village's original illustration style, map locations, energy rewards and chicken flight remain connected to the same world. No external game assets or branded interfaces are used.

## Fishing

1. Start at a fishing marker. Choose bread (smaller carp) or worms (mixed fish) with **B** / the bait button.
2. Hold **Q** / Cast to choose a 5–15 m throw, then release. A short tap casts a medium distance. The float travels in an arc and a curved line connects it to the rod.
3. Small float movements are nibbles. Wait for the float to sink and the **BITE** cue, then tap **Q** / Hook. Twitching bait before a bite delays the next bite slightly.
4. Hold **Q** to reel while the fish rests. Release while it struggles. The on-screen Reel button also toggles steady reeling for players who prefer tapping once.
5. **B** / Give line reduces tension but lets the fish swim further away. Hold **Z** / left brace or **V** / right brace against the fish's pulling direction to reduce its advantage. There is a text cue as well as the colour meter.
6. A snapped line, escaped fish or missed bite allows another cast within the same outing. Landing shows the species, length and weight with a visible fish. **Q** / Release finishes the outing and restores 16 energy.

The fish alternates between rests and surges, with randomly varied timing and direction. Size and species affect its strength. Longer casts require more reeling. This is an original simplified interaction inspired by the user's Red Dead Redemption reference, not a recreation of that game's rules. [Rockstar's wildlife overview](https://www.rockstargames.com/newswire/article/51974aa3a8k847/Wildlife-in-Red-Dead-Redemption-2) was consulted for the broad emphasis on responsive wildlife; the numerical rules here are our own.

## Other activities

| Activity | Choices and feedback | Reward |
| --- | --- | --- |
| Potato | B switches hot/gentle embers. Q turns the potato. Each face browns separately and only the lower face cooks. Turn at golden (70–115%); serve with Q when both faces are ready. Leaving a face to reach 130% burns it. The potato turns visibly and the fire changes with heat. | 26 |
| Watermelon | B toggles a quiet crouched pace (0.9 m/s, running disabled). Moving quickly builds a rustle meter; stopping lowers it. Hold Q for 2.2 seconds beside an actual ripe fruit to harvest. The touch button also toggles picking. Excess noise ends the attempt. | 22 |
| Rabbit | B enables the quiet pace. Nearby quiet movement or waiting makes the rabbit settle and fills its trust meter; rushing makes it flee. At high trust, approach within 1.7 m and Q scoops it up and releases it. | 12 |
| Kite | Hold Q / toggle Pull in gentle wind to gain height; release or B to ease during gusts. Pulling through a strong gust raises tension and can tangle the kite. The kite's actual height follows progress. | 10 |
| Firework | B chooses meadow gold, rose pink or river blue. Q lights the fuse when ready; a visible launch and bloom complete the activity. | 10 |

X / Leave packs up any activity. Riding or chicken flight also cancels it. Weather, season, distance and cooldown conditions remain enforced. Activities pause energy drain, and rewards occur only after successful completion.

## Timing and controls

Waiting for fish and passive nibbles use active elapsed time, while interactive reaction/fight/cooking steps cap each frame's advancement at 0.25 seconds. A delayed render cannot instantly snap the line, burn a potato or consume a newly shown bite window. This deliberately makes the interactive processes run slower when rendering is slow. Menus and hidden tabs pause; blur, visibility changes, pointer cancellation and menus clear holds and toggled reels. Restarting a missed cast does not award energy.

All new actions have labelled on-screen buttons for phone and keyboard use. Holding has pointer capture and cancellation support. There is no rapid tapping requirement. C still levels the camera; Z/V only control the rod during a fish fight. The expanded navigation map remains above the activity panel.

## Checks

- `test:fishing`: variable cast distance and bait; nibble/bite distinction; multi-stage successful catch; line break, retry and give-line tradeoff; slow-frame and input clearing.
- `test:adventure`: all six completions, potato burning, noisy harvesting failure, rabbit trust, energy/cooldown/season/menu behavior.
- `test:interactive`: actual desktop and phone map entry, button reachability, bait/cast/hook/reel/brace/line controls, held keyboard and touch input, menu cancellation, landing/release and cooking. Long local sequences use simulated active steps through the real controller to avoid depending on software GPU speed.
- Existing game, upstairs and comfort controller checks cover the shared navigation and flight integration. Production browser checks use public controls to enter and hook a fish, then leave safely.

## Toy controls

Select 1 for the slingshot or 2 for the water pistol. In free-camera mode, click the scene to fire and drag to look. Hold right mouse, P, or the visible trigger button to squirt water or draw the slingshot; release to launch a stone. Touch movement and trigger holds use separate pointer IDs, so lifting the movement finger does not end a shot. Menus, activities, flight and lost focus cancel a held trigger safely.

The tool-input controller checks click/drag separation, charged shots, touch holds and cancellation. The tool browser check verifies actual water and stone projectiles with desktop, keyboard and touch input.
