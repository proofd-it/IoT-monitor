const URL = "https://dryja.dev/conn?n=";
// How often to perform Bluetooth scanning.
// const SCAN_FREQ = 10000;
const SCAN_FREQ = 2 * 60000;
const SECOND_SCAN = 15000;
// Minimum required signal strenght in dB.
const MIN_DB = -85;
const STATE_MAP = {
  OUTSIDE : 0,
  TRANSPORT : 1,
  FRIDGE : 2
};
// How often record data for each phase, in miliseconds.
const FREQUENCIES = {
  0 : 10 * 60000,
  1 : 15 * 60000,
  2 : 20 * 60000
};
// How often to poll once the temperatue has been spotted as too high.
const ALERT_FREQ = 3 * 60000;
const MAX_TEMP = {
  0 : 15,
  1 : 15,
  2 : 5
};
// ==============================
// ONLY change ABOVE this line ^^^
// ==============================

var state;
var scanInterval;
var logInterval;
var pastReadings;

function onInit() {
  console.log("Start");
  var name = getSerial().substring(0, 8).toLowerCase();
  var secondScan = false;
  NRF.setAdvertising({}, {name : name});
  NRF.nfcURL(URL + name);

  // Set only if reset.
  // setTime();

  pastReadings = 0;
  // When restarted, default to state outside.
  state = STATE_MAP.OUTSIDE;

  // Watch for reset button press. More than 3 seconds will initiate tearDown.
  setWatch(function() {
    var cancel = false;
    var led = false;
    var interval = setInterval(function() {
      led = !led;
      digitalWrite(LED1, !led ? 1 : 0);
    }, 200);
    // Cancel if button released within 3 seconds.
    setWatch(function() {
      cancel = true;
      digitalWrite(LED1, 0);
      clearInterval(interval);
    }, BTN, {edge : "falling", debounce : 50, repeat : false});

    setTimeout(function() {
      if (!cancel) {
        tearDown();
        digitalWrite(LED1, 0);
        clearInterval(interval);
      }
    }, 5000);
  }, BTN, {edge : "rising", debounce : 50, repeat : true});

  var logging = function() {
    console.log("checking temperature");
    var temp = E.getTemperature();
    if (temp > MAX_TEMP[state] && pastReadings > 3) {
      // Temperature was too high for 4 times in a row
      console.log("temp way too high for too long, logging!");
      logState(state, 1);
    } else if (temp > MAX_TEMP[state]) {
      // Temperature recorded was too high, although check again in the future.
      console.log("temperature too high, will check again");
      pastReadings += 1;
      changeInterval(logInterval, ALERT_FREQ);
    } else {
      console.log("temperature is back to normal");
      pastReadings = 0;
      logState(state, 0);
      changeInterval(logInterval, FREQUENCIES[state]);
    }
  };
  var scanning = function() {
    NRF.findDevices(function(devices) {
      var device = devices.pop();
      var newState;
      if (device && device.rssi < MIN_DB) {
        console.log("Too far away, ignoring");
        newState = STATE_MAP.OUTSIDE;
      } else {
        newState =
            device ? STATE_MAP[device.name.toUpperCase()] : STATE_MAP.OUTSIDE;
      }
      if (secondScan && newState != state) {
        console.log(
            "Change of state detected and it's a second scan. Logging change");
        state = newState;
        logState(newState, 0);
        pastReadings = 0;
        logging();
        secondScan = false;
        changeInterval(logInterval, FREQUENCIES[newState]);
        changeInterval(scanInterval, SCAN_FREQ);
      } else if (newState != state) {
        console.log("Change of state detected, although it's the first change");
        secondScan = true;
        changeInterval(scanInterval, SECOND_SCAN);
      } else {
        console.log("state unchanged");
        secondScan = false;
      }
    }, {
      timeout : 5000,
      filters : [ {namePrefix : "fridge"}, {namePrefix : "transport"} ]
    });
  };
  // Scan for nearby beacons.
  scanInterval = setInterval(scanning, SCAN_FREQ);
  // Interval checking temperature.
  logInterval = setInterval(logging, FREQUENCIES[state]);
}

function tearDown() {
  // Light blue LED for confirmation.
  digitalWrite(LED3, 1);
  setTimeout(function() {
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
//   "t": temperature in C,
//   "s": state based on nearby beacons,
//   "b": battery percentage,
//   "a": boolean, whether it's alert
// }
function logState(s, a) {
  var f = require("Storage");
  var name = Math.ceil(getTime()) % 100000000;
  f.write(name, JSON.stringify({
    d : Math.ceil(getTime()),
    t : E.getTemperature(),
    s : s,
    b : Puck.getBatteryPercentage(),
    a : a
  }));
}

function getNames() {
  var f = require("Storage");
  return f.list();
}

function getReading(name) {
  var f = require("Storage");
  return f.read(name);
}

onInit();
