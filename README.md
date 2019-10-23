# PuckJS code

## Worklog

## 23-10-2019

- I have created and pushed the code for the dummy tracker. It's sole responsibility is to record the temperature every 5 minutes and dump it into flash storage. It will log timestamp, temperature and battery percentage (not aware of states).
- For the main, smart scanner I have removed continuous logging in favour of introducing logic to disregard readings in case the temperature remains stable and below specified threshold. This should significantly limit the amount of data dumped into the flash storage (see further points for exact values).
- A new field to the logging JSON has been added, called "a". 
