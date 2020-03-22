# beacon
Collection of JS files used with Proofd-It project. They are intended to be run inside (PuckJS)[https://www.puck-js.com/] and uploaded via (espruino IDE)[https://www.espruino.com/ide/#].

## beacon.js
A smart logger which will periodically scan for temperature and nearby beacons. All constants can be found in the file, at the very top, with attached explanations.

## fridge.js
Example of locational beacon, which advertises its name, which then can be detected by smart beacons

## scanner.js
Dumbed down version of `beacon.js`, which constantly dumps current temperature to the flash storage for experimentation purposes.
