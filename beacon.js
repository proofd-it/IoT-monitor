const URL = "trustlens.abdn.ac.uk/conn?n=";
// How often to perform Bluetooth scanning.
const scanFreq = 1 * 60000;
// Minimum required signal strenght in dB.
const mindDb = -85;
// How often record data for each phase, in miliseconds.
const frequencies = {
  "outside" : 60000,
  "transport" : 30 * 60000,
  "fridge" : 60000
};
// ==============================
// ONLY change ABOVE this line ^^^
// ==============================

var state = "outside";
var scanInterval;
var logInterval;

function onInit() {
  var name = getSerial().substring(0, 8).toLowerCase();
  NRF.setAdvertising({}, {name : name});
  NRF.nfcURL(URL + name);

  // Set only if reset.
  // setTime();

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

  // Interval contiuously logging current state.
  logInterval =
      setInterval(function() { logState(state); }, frequencies[state]);

  // Scan for nearby beacons.
  scanInterval = setInterval(function() {
    NRF.findDevices(function(devices) {
      var device = devices.pop();
      if (device && device.rssi < mindDb) {
        console.log("Too far away, ignoring");
        return;
      }
      var newState = device ? device.name : "outside";
      if (newState != state) {
        changeInterval(logInterval, frequencies[newState]);
        state = newState;
      }
    }, {
      timeout : 2000,
      filters : [ {namePrefix : "fridge"}, {namePrefix : "transport"} ]
    });
  }, scanFreq);
}

function tearDown() {
  // Light blue LED for confirmation.
  digitalWrite(LED3, 1);
  setTimeout(function() { digitalWrite(LED3, 0); }, 3000);
  // Remove all existing logs.
  var f = require("Storage");
  f.eraseAll();
}

// Logs current state to the flash storage.
// It will save it under file named after last 8 digits of current timestamp.
//
// JSON will be of following structure:
// {
//   "d": timestamp in seconds,
//   "t": temperature in C,
//   "s": state based on nearby beacons,
//   "b": battery percentage
// }
function logState(s) {
  var f = require("Storage");
  var name = Math.ceil(getTime()) % 100000000;
  f.write(name, JSON.stringify({
    d : Math.ceil(getTime()),
    t : E.getTemperature(),
    s : s,
    b : Puck.getBatteryPercentage()
  }));
}

function getData() {
  var f = require("Storage");
  var all = "[";
  f.list().forEach(function(name) { all += f.read(name) + ","; });
  return all === "]" ? "{}" : all.slice(0, -1) + "]";
}

onInit();
