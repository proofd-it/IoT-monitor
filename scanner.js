const SCAN_FREQ = 5 * 60000;

function onInit() {
  // Watch for reset button press. More than 3 seconds will initiate tearDown.
  setWatch(function() {
    var cancel = false;
    var led = false;
    var interval = setInterval(function() {
      led = !led;
      digitalWrite(LED2, !led ? 1 : 0);
    }, 200);
    // Cancel if button released within 3 seconds.
    setWatch(function() {
      cancel = true;
      digitalWrite(LED2, 0);
      clearInterval(interval);
    }, BTN, {edge : "falling", debounce : 50, repeat : false});

    setTimeout(function() {
      if (!cancel) {
        tearDown();
        digitalWrite(LED2, 0);
        clearInterval(interval);
      }
    }, 5000);
  }, BTN, {edge : "rising", debounce : 50, repeat : true});

  var scanInterval = setInterval(function() { logState(); }, SCAN_FREQ);
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
//   "b": battery percentage
// }
function logState(s) {
  var f = require("Storage");
  var name = Math.ceil(getTime()) % 100000000;
  f.write(name, JSON.stringify({
    d : Math.ceil(getTime()),
    t : E.getTemperature(),
    b : Puck.getBatteryPercentage()
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
