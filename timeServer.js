const NAME = "timeServer";
const TIMESTAMP = 0;


function onInit() {
  setTime(TIMESTAMP);
  NRF.setAdvertising({}, {name: NAME, interval: 300});
  setWatch(function (e) {
    digitalWrite(LED1, 1);
    setTimeout(function () {
      digitalWrite(LED1, 0);
    }, 500);
  }, BTN, {repeat: true, edge: 'rising'});
}
function readTime() {
  return getTime();
}
onInit();
