// Set to true to use shorter threshold suitable for testing.
const DEV_MODE = false;
// Whether to use probe or internal sensor to get ambient temperature.
const USE_PROBE = true;

let SCAN_FREQ;
let SECOND_SCAN;
let FREQUENCIES;
let ALERT_FREQ;
let TEMP_REPEAT;

if (DEV_MODE) {
  SCAN_FREQ = 10000;
  SECOND_SCAN = 10000;
  FREQUENCIES = {0: 10000, 1: 10000, 2: 10000};
  ALERT_FREQ = 10000;
  TEMP_REPEAT = 1;
} else {
  // How often to perform Bluetooth scanning.
  SCAN_FREQ = 7 * 60000;
  SECOND_SCAN = 1 * 60000;
  // How often record data for each phase, in miliseconds.
  FREQUENCIES = {0: 10 * 60000, 1: 15 * 60000, 2: 20 * 60000};
  ALERT_FREQ = 10 * 60000;
  TEMP_REPEAT = 3;
}

const TRUSTLENS_URL = "https://trustlens.abdn.ac.uk/webapp/receive?n=";
const SCAN_DURATION = 2500;
// Minimum required signal strenght in dB.
const MIN_DB = -85;
const STATE_MAP = {
  OUTSIDE: 0,
  TRANSPORT: 1,
  FRIDGE: 2
};
const HUMAN_STATE = {
  0: "outside",
  1: "transport",
  2: "fridge"
};
// How often to poll once the temperatue has been spotted as too high.
const MAX_TEMP = {
  0: 25,
  1: 5,
  2: 5
};
// Maximum number of temperature readings per stage to output on final JSON
const MAX_DATA_SAMPLES = 24;
// Offset for temperature
const TEMP_OFFSET = 1.0;
// WARNING THERSHOLDS
// Durations specified in seconds
// Maximum allowed number of times the item can be outside.
const MAX_TOTAL_OUTSIDE_TIMES = 1;
// Maximum cumulative allowed time outside
const MAX_TOTAL_OUTSIDE = 3 * 3600; // 5 hours
// Maximum cumulative allowed time in transport
const MAX_TOTAL_TRANSPORT = 5 * 3600; // 5 hours
// Maximum cumulative allowed time in the fridge
const MAX_TOTAL_FRIDGE = 15 * 3600; // 15 hours
// ==============================
// ONLY change ABOVE this line ^^^
// ==============================

var state;
var scanInterval;
var logInterval;
var pastReadings;
var startTime;

var max_t = -100;
var min_t = 100;
var rollingAverage = 0;
var totalReadings = 0;

var firstRun = true;

function readProbe() {
  var t1, t2;
  while (!t2) {
    try {
      var ow = new OneWire(D1);
      var sensor = require("DS18B20").connect(ow);
      while (!t1 || !t2) {
        t1 = sensor.getTemp();
        t2 = sensor.getTemp();
      }
    } catch (err) {
    }
  }
  return t2;
}

function readTemp() {
  if (USE_PROBE) {
    return readProbe() + TEMP_OFFSET;
  } else {
    return E.getTemperature() + TEMP_OFFSET;
  }
}

function readServerTime() {
  var uart;
  NRF.requestDevice({timeout: 3000, filters: [{namePrefix: 'timeServer'}]}).then(function (device) {
    return require("ble_uart").connect(device);
  }).then(function (u) {
    uart = u;
    return new Promise(function (r) {setTimeout(r, 1000);});
  }).then(function () {
    return uart.eval('readTime()');
  }).then(function (data) {
    setTime(data);
    uart.disconnect();
  });
}

function onInit() {
  if (firstRun) {
    try {
      readServerTime();
      setTimeout(function () {
        mainLoop();
      }, 6000);
    }
    catch (e) {
      console.log("Time puck not found, continuouing without");
    }
  }
}

function mainLoop() {
  var name;
  var secondScan;

  name = getSerial().substring(0, 8).toLowerCase();
  NRF.nfcURL(TRUSTLENS_URL + name);
  secondScan = false;
  NRF.setAdvertising({}, {name: name});
  startTime = Math.ceil(getTime());
  pastReadings = 0;
  // When restarted, default to state outside.
  state = STATE_MAP.OUTSIDE;

  console.log("Start");
  firstRun = false;
  clearInterval();

  // Watch for reset button press. More than 3 seconds will initiate tearDown.
  setWatch(function () {
    var cancel = false;
    var led = false;
    var interval = setInterval(function () {
      led = !led;
      digitalWrite(LED1, !led ? 1 : 0);
    }, 200);
    // Cancel if button released within 3 seconds.
    setWatch(function () {
      cancel = true;
      digitalWrite(LED1, 0);
      clearInterval(interval);
    }, BTN, {edge: "falling", debounce: 50, repeat: false});

    setTimeout(function () {
      if (!cancel) {
        tearDown();
        digitalWrite(LED1, 0);
        clearInterval(interval);
      }
    }, 3000);
  }, BTN, {edge: "rising", debounce: 50, repeat: true});

  var logging = function () {
    console.log("checking temperature");
    var temp = readTemp();
    totalReadings += 1;
    max_t = Math.max(max_t, temp);
    min_t = Math.min(min_t, temp);
    rollingAverage = rollingAverage ? (rollingAverage + temp) / 2 : temp;
    if (temp > MAX_TEMP[state] && pastReadings > TEMP_REPEAT) {
      // Temperature was too high for TEMP_REPEAT times in a row
      console.log("temp way too high for too long, logging!");
      logState(state, 1, max_t, min_t, rollingAverage, temp);
    } else if (temp > MAX_TEMP[state]) {
      // Temperature recorded was too high, although check again in the future.
      console.log("temperature too high, will check again");
      pastReadings += 1;
      changeInterval(logInterval, ALERT_FREQ);
    } else if (pastReadings > 0) {
      console.log("temperature is back to normal");
      pastReadings = 0;
      changeInterval(logInterval, FREQUENCIES[state]);
    }
  };
  var scanning = function () {
    NRF.findDevices(function (devices) {
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
        secondScan = false;
        var temp = readTemp();
        logState(state, 0, temp, temp, temp, temp);
        changeInterval(logInterval, FREQUENCIES[newState]);
        changeInterval(scanInterval, SCAN_FREQ);
        rollingAverage = 0;
        max_t = -100;
        min_t = 100;
        totalReadings = 0;
      } else if (newState != state) {
        console.log("Change of state detected, although it's the first change");
        secondScan = true;
        changeInterval(scanInterval, SECOND_SCAN);
      } else {
        console.log("state unchanged");
        secondScan = false;
      }
    }, {
      timeout: SCAN_DURATION,
      filters: [{namePrefix: "fridge"}, {namePrefix: "transport"}]
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
  setTimeout(function () {
    digitalWrite(LED3, 0);
    // Remove all existing logs.
    var f = require("Storage");
    let names = getNames();
    names.forEach(function (element) {
      f.erase(element);
    });
    f.erase("readings");
    mainLoop();
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
//   "min": minimum temperature recorded in given state so far,
//   "max": maximum temperature recorded in given state so far,
//   "avg": rolling average temperature recorded in given state so far,
//   "a": boolean, whether it's alert
//   "tot": int, how many temperature readings so far,
// }
function logState(s, a, max, min, avg, temp) {
  var f = require("Storage");
  var name = Math.ceil(getTime()) % 100000000;
  f.write(name, JSON.stringify({
    d: Math.ceil(getTime()),
    t: temp,
    s: s,
    b: Puck.getBatteryPercentage(),
    min: min,
    max: max,
    avg: avg,
    a: a,
    tot: totalReadings
  }));
  appendTimestamp(name);
  console.log(getReading(name));
}

function appendTimestamp(name) {
  var f = require("Storage");
  let r = f.read("readings");
  if (r == "" || r == null) {
    f.write("readings", name);
    return;
  }
  let y = `${r}`;
  f.write("readings", y + " " + name);
}

function getNames() {
  let f = require("Storage");
  let readings = f.read("readings");
  return readings.split(" ");
}

function getReading(name) {
  var f = require("Storage");
  return f.read(name);
}

function getDate(seconds) {
  var str = (new Date(seconds * 1000)).toString();
  return str.substring(0, str.length - 9);
}

function getAll() {
  var all = {"states": []};
  var names = getNames();
  var currentState;
  var sampleCount = 0;
  for (var i = 0; i < names.length; i++) {
    var reading = JSON.parse(getReading(names[i]));
    var dateString = getDate(reading.d);
    if (HUMAN_STATE[reading.s] != currentState) {
      sampleCount = 0;
      currentState = HUMAN_STATE[reading.s];
      all.states.push({
        state: currentState,
        timeStart: currentState ? dateString : getDate(startTime),
        timeStartSeconds: currentState ? reading.d : startTime,
        assessment: !reading.a ? "ok" : "not ok",
        average: reading.avg,
        data: [],
        totalReadings: reading.tot
      });
    } else {
      all.states[all.states.length - 1].assessment =
        !reading.a ? "ok" : "not ok";
      all.states[all.states.length - 1].totalReadings = reading.tot;
      if (sampleCount < MAX_DATA_SAMPLES) {
        all.states[all.states.length - 1].data.push(
          {y: reading.t, t: dateString});
      }
      sampleCount += 1;
    }
  }
  all.states[all.states.length - 1].timeEnd = getDate(Math.ceil(getTime()));

  var maxOutside = 0;
  var maxFridge = 0;
  var maxTransport = 0;
  var totalOutside = 0;
  for (i = 0; i < all.states.length; i++) {
    var duration;
    if (i < all.states.length - 1) {
      all.states[i].timeEnd = all.states[i + 1].timeStart;
      duration =
        all.states[i + 1].timeStartSeconds - all.states[i].timeStartSeconds;

      all.states[i].totalReadings = all.states[i + 1].totalReadings - 1;
      all.states[i].average = all.states[i + 1].average;
    } else {
      duration = getTime() - all.states[i].timeStartSeconds;
      all.states[i].totalReadings = totalReadings;
      all.states[i].average = rollingAverage;
    }
    switch (all.states[i].state) {
      case "outside":
        maxOutside += Math.ceil(duration);
        totalOutside += 1;
        break;
      case "transport":
        maxTransport += Math.ceil(duration);
        break;
      case "fridge":
        maxFridge += Math.ceil(duration);
        break;
    }

    if (all.states[i].state == "outside") {
    }
    delete all.states[i].timeStartSeconds;
  }

  all.warnings = [];
  if (totalOutside > MAX_TOTAL_OUTSIDE_TIMES) {
    all.warnings.push({
      code: 1, warning: "Item has been kept outside chilled storage " + totalOutside + " number of times. The maximum allowed number of outside stages is " +
        MAX_TOTAL_OUTSIDE_TIMES + " times."
    });
  }
  if (maxOutside > MAX_TOTAL_OUTSIDE) {
    all.warnings.push({
      code: 2, warning: "The item has been outside the chilled storage for " + (maxOutside / 3600.0).toFixed(2) + " hours. The maximum allowed time is " + (MAX_TOTAL_OUTSIDE / 3600.0).toFixed(2) + " hours"
    });
  }
  if (maxFridge > MAX_TOTAL_FRIDGE) {
    all.warnings.push({
      code: 3, warning: "The item has been in chilled storage for " + (maxFridge / 3600.0).toFixed(2) + " hours. The maximum allowed time is " + (MAX_TOTAL_FRIDGE / 3600.0).toFixed(2) + " hours"
    });
  }
  if (maxTransport > MAX_TOTAL_TRANSPORT) {
    all.warnings.push({
      code: 4, warning: "Item has been in transport for " + (maxTransport / 3600.0).toFixed(2) + " hours. The maximum allowed time is " + (MAX_TOTAL_TRANSPORT / 3600.0).toFixed(2) + " hours"
    });
  }
  all.puckID = getSerial().substring(0, 8).toLowerCase();
  return JSON.stringify(all);
}
onInit();
