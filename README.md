# PuckJS code

## Worklog

## Week of 21-10-2019

- I have created and pushed the code for the dummy tracker. It's sole responsibility is to record the temperature every 5 minutes and dump it into flash storage. It will log timestamp, temperature and battery percentage (not aware of states).
- For the main, smart scanner I have removed continuous logging in favour of introducing logic to disregard readings in case the temperature remains stable and below specified threshold. This should significantly limit the amount of data dumped into the flash storage (see further points for exact values).
- A new field to the logging JSON has been added, called "a", indicating whether the logging has been made in an "alert" fashion, meaning that the temperature has exceeded the expected threshold.
- The "alert" will only trigger if the temperature has exceeded threshold for 4 times in a row. During that period, the temperature will be captured with an increased frequency of every 3 minutes (configurable via ALERT_FREQ).
- I've discovered some bugs that I have fixed. One example being that "double scan", in case "fridge" beacon is no longer detected, has fired only for the first time and the flag never reset back...
- I have also left the "beacon" Puck in the fridge overnight to see how it behaves. There's been some interesting results:
    * There's been combined 16 logs recorded after I left the puck in the fridge on Tuesday 22nd at 10pm and checked again at 8am the following day. The main (and only cause) of multiple-logging was still state flapping. The Puck - even after implementing "second scan" mitigation - was still every now and then not capturing fridge beacon (located just outside the fridge) for 2 times in a row. To rectify this, we might further increase the BT scanning time and / or change "second scan" to a "third scan".
    * Temperature - I am not 100% sure whether the recording captured by the Puck is accurate. The average temperature recorded for the duration of the night was -2°C. I can't speak for sure, but I don't believe my fridge sits at lower than 0. Might need to investigate further with more precise thermometer to see if there are any deviations
    * Battery, now that's quite interesting. I found that the most recent log (that occured at roughly 6am) had battery reading at circa 60 percent. Although, once I removed the Puck from the Fridge, the reported battery percentage has increased to 80%. I suspect that the battery reading is based on current Voltage (which decreases when it's cold?), thus the reported percentage drops as well. Following the source code of Espruino - https://github.com/espruino/EspruinoDocs/blob/eba6107ca701425496a1ea175ce983711a13fc0e/bin/espruino.json#L3054 - which reads: "Return an approximate battery percentage remaining based on\na normal CR2032 battery (2.8 - 2.2v)". So indeed they are basing the percante on voltage
