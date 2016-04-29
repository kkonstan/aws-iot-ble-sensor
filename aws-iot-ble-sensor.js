// AWS IoT Device app that continuously scans for and reports detected iBeacons - Sensor

var os = require('os');
var awsIot = require('aws-iot-device-sdk');
var ble = require('bleacon');



// parse command line arguments
var commandLineArgs = require('command-line-args');

var args = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'led', alias: 'l', type: Boolean, defaultValue: false },
])

var options = args.parse()



//
// LED blinking
//

// which gpio pins correspond to the r, g & b leds
// rgb led recommended, eg: http://www.monkmakes.com/squid/
const led_r = 12;
const led_g = 16;
const led_b = 18;

// start with red
var led=led_r;

// to switch color, set this to the new one
var led_switch=0;

// set the blink frequency
var blink_on = 10;
var blink_off = 4990;

if (options.led) {
  try {
     var gpio = require('rpi-gpio');
  } catch(err) {
     console.error("LED: Not found");
     options.led=false;
  }
}

if (options.led) {
  // setup gpio for the led
  gpio.setup(led_r, gpio.DIR_OUT);
  gpio.setup(led_g, gpio.DIR_OUT);
  gpio.setup(led_b, gpio.DIR_OUT);

  // start blinking LED
  led_on();

  function led_on() {
      setTimeout(function() {
          gpio.write(led, 1, led_off);
      }, blink_off);
  }

  function led_off() {
      setTimeout(function() {
        gpio.write(led, 0, led_on);
        if (led_switch !=0) {
            led=led_switch;
            led_switch=0;
        }
    }, blink_on);
  }
}



// use the hostname to identify this instance of the sensor
const sensor = os.hostname().split('.').shift();

// use this topic for heartbeats
const topicHeartbeat = 'heartbeat';

// use this topic for detections
const topicDetection = 'detection';



// connect to AWS IoT
const aws = awsIot.device({
    keyPath: './certs/private.pem.key',
    certPath: './certs/certificate.pem.crt',
    caPath: './certs/root-CA.crt',
    region: 'eu-central-1',
    clientId: sensor,
    offlineQueueing: true,
    offlineQueueMaxSize: 0,
    drainTimeMs: 10
});



// publish a heartbeat every 5 seconds
timeout = setInterval(function() {

    // prepare JSON message
    var message = JSON.stringify({
        timestamp: new Date().toJSON(),
        type: 'heartbeat',
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        sensor: sensor,
    })

    // publish to the heartbeat topic
    aws.publish(topicHeartbeat, message, { qos: 1 });

    if (options.verbose) {
      // also log to console
      console.log(message);
    }
}, 5000);


// start scanning for iBeacons
ble.startScanning();



//
//   Bleacon event handlers
//

ble
    .on('discover', function(beacon) {

        // prepare JSON message
        var message = JSON.stringify({
            timestamp: new Date().toJSON(),
            type: 'detection',
            uuidmm: beacon.uuid + ':' + beacon.major + '/' + beacon.minor,
            proximity: beacon.proximity,
            sensor: sensor
        });

        // publish to the detection topic
        aws.publish(topicDetection, message, { qos: 1 });

        if (options.verbose) {
          // also log to console
          console.log(message);
        }
    });



// 
// AWS IoT event handlers
//

aws
    .on('connect', function() {
        console.log('AWS IoT Device Gateway: Connected');
    });
aws
    .on('close', function() {
        console.log('AWS IoT Device Gateway: Closed');
    });
aws
    .on('reconnect', function() {
        console.log('AWS IoT Device Gateway: Reconnected');
    });
aws
    .on('offline', function() {
        console.log('AWS IoT Device Gateway: Offline');
    });
aws
    .on('error', function(error) {
        console.log('AWS IoT Device Gateway: Error -', error);
    });
aws
    .on('message', function(topic, payload) {
       console.log(payload.toString());
    });
