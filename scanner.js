const DEV = false;

const USE_PROBE = false;
const TIME = null;
const NAME = "logger";

if (DEV) {
  const SCAN_FREQ = 5000;
} else {
  const SCAN_FREQ = 5 * 60000;
}
if (TIME) {
  setTime(TIME);
}

var ow = new OneWire(D1);
var sensor;
if (USE_PROBE) {
  while (!sensor) {
    try {
      sensor = require("DS18B20").connect(ow);
    }
    catch (e) {
    }
  }
}

function onInit() {
  // Watch for reset button press. More than 3 seconds will initiate tearDown.
  NRF.setAdvertising({}, {name: NAME});
  setWatch(function () {
    var cancel = false;
    var led = false;
    var interval = setInterval(function () {
      led = !led;
      digitalWrite(LED2, !led ? 1 : 0);
    }, 200);
    // Cancel if button released within 3 seconds.
    setWatch(function () {
      cancel = true;
      digitalWrite(LED2, 0);
      clearInterval(interval);
    }, BTN, {edge: "falling", debounce: 50, repeat: false});

    setTimeout(function () {
      if (!cancel) {
        tearDown();
        digitalWrite(LED2, 0);
        clearInterval(interval);
      }
    }, 3000);
  }, BTN, {edge: "rising", debounce: 50, repeat: true});

  setInterval(function () {logState();}, SCAN_FREQ);
}

function tearDown() {
  // Light blue LED for confirmation.
  digitalWrite(LED3, 1);
  setTimeout(function () {
    digitalWrite(LED3, 0);
    // Remove all existing logs.
    var f = require("Storage");
    f.eraseAll();
    // Restart the beacon.
    onInit();
  }, 3000);
}

// Logs current state to the flash storage.
// It will save it under file named after last 8 digits of current timestamp.
//
// JSON will be of following structure:
// {
//   "d": timestamp in seconds,
//   "t_sensor": temperature in C from internal sensor,
//   "t_probe": temperature in C from external probe,
//   "s": state based on nearby beacons,
//   "b": battery percentage
// }
function logState() {
  var f = require("Storage");
  var name = Math.ceil(getTime()) % 100000000;

  var probe = null;
  if (USE_PROBE) {
    probe = readProbe();
    console.log("probe temp is: " + probe);
  }
  f.write(name, JSON.stringify({
    d: Math.ceil(getTime()),
    t_sensor: E.getTemperature(),
    t_probe: probe,
    b: Puck.getBatteryPercentage()
  }));
  console.log(f.read(name));
}

function readProbe() {
  var t1, t2;
  while (!t2) {
    while (!t1 || !t2) {
      t1 = sensor.getTemp();
      t2 = sensor.getTemp();
    }
  }
  return t2;
}

function getNames() {
  var f = require("Storage");
  return f.list();
}

function getReading(name) {
  var f = require("Storage");
  return f.read(name);
}

function getAll() {
  var names = getNames();
  names.forEach(function (item) {
    console.log(getReading(item));
  });
}

onInit();
