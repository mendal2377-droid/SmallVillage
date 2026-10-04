# Mouse aiming

All five toys use a ray through the mouse crosshair instead of always using the
camera's forward direction. Mouse movement changes aim without turning the view;
dragging still turns the camera and does not fire. Left click fires once, and the
right mouse button or P supports charging the slingshot and continuous water or
firework shots. Moving the mouse during a hold changes subsequent shots, including
the slingshot's release direction.

The reticle becomes a visible ring with four marks when a toy is selected. The
held model turns with the aim. Projectile origins lie on the camera ray to avoid
sideways parallax at close range; existing gravity, launch arcs, spread, collisions
and non-lethal target reactions remain. The reticle indicates launch direction,
not a guaranteed impact point for an arcing projectile.

Touch gestures turn the view, with the reticle centred, and the separate trigger
button fires. Pointer lock also keeps centred aim. Resize, focus loss and pointer
lock transitions reset aim and cancel a held trigger; activities and menus still
block firing.

Checks: `npm run test:aim`, `npm run test:tool-input`, `npm run test:game`,
`npm run test:coast`, `npm run test:aim-ui`, and `npm run build`.
