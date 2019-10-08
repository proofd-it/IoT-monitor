const URL = "trustlens.abdn.ac.uk/conn?n=";
var data = {"place" : "holder"};

function setUp() {
  var name = getSerial().substring(0, 8).toLowerCase();
  NRF.setAdvertising({}, {name : name});
  NRF.nfcURL(URL + name);

  // Watch for reset button press. More than 3 seconds will initiate tearDown.
  setWatch(function() {
    var cancel = false;
    var led = false;
    var interval = setInterval(function() {
      led = !led;
      digitalWrite(LED1, !led ? 1 : 0);
    }, 200);
    // Cancel if button pressed within the duration.
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
    }, 3000);
  }, BTN, {edge : "rising", debounce : 50, repeat : true});
}

function tearDown() { console.log("tearing down the execution"); }

function getData() { return JSON.stringify(data); }

setUp();
