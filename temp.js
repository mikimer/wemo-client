
// Mike is modifying Jeremy's code to try to understand it. 
// removing all google api parts. 

console.log('Mikes code is running');

// discovers Wemo Insight switches, listens to power information, writes data to local file AND/OR Google spreadsheet
// command: node insight.js [--google] [--nolocal]
// --google: write data to a Google Spreadsheet (Experimental...)
// --nolocal: don't write data to a local file (one per hour)


// npm libraries for general operation 
var Wemo = require('wemo-client');
var util = require('util');
var fs = require('fs');
const wifiName = require('wifi-name');

//cache of multiple measures to write in batch to gdrive 
var queue=[];


//npm install command-line-args
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
  { name: 'nolocal', alias: 'n', type: Boolean}
];
const options = commandLineArgs(optionDefinitions);
const WRITE_LOCAL= !options["nolocal"];

// starting the on-going code here. 
var wemo = new Wemo();
var name = 'undefined wifi'; 
var dummy = 0; 

// THIS IS THE MAIN() FUNCTION 
console.log('wifi is starting as:' + name);
checkWiFi();
console.log('wifi is now:' + name);

try{
    triggerDiscovery();
  }
catch(err){
  console.log("something went wrong"); 
  console.error("%s %s",new Date().toISOString(),err);
}

// create dummy data to send to the cloud 
function createDummy(){
  dummy =  Math.round( Math.random() * (100 - 1) + 1 );
  console.log('got a dummy data point: ');
  console.log(dummy);
} // end createDummy


// try to discover the Wemos every 10sec in case a device falls off the network. 
function triggerDiscovery(){

  //announce the discovery process
  console.log("%s INFO discovering Wemo switches",new Date().toISOString());

  // get dummy data 
  createDummy();

  try{
    //try to discover a wemo on the same wifi network. If this app/client and the belkin wemos aren't on the same network, this app breaks
    wemo.discover(function (err,deviceInfo){

      if (deviceInfo !=null 
        && deviceInfo.deviceType=="urn:Belkin:device:insight:1"
        && deviceInfo.UDN != null){
        // if the device isn't null, and it's a wemo insight, and its UDN isn't null, then announce the discovery 
        // ** QUESTION: where does friendlyName come from? It looks like it's hard wired in the Wemo deviceInfo ** 
        console.log("%s INFO discovered:%s,%s",new Date().toISOString(),deviceInfo.UDN,deviceInfo.friendlyName);
        // since the wemo is discovered, 
        try{
          // Get the client for the found device
          var client=wemo.client(deviceInfo);

          // get the wemo insightParams binaryState(on/off), instant power in milliwatts, aggregated data (object)
          client.on('insightParams', function(binaryState, instantPower, data){
            // print to the file the data from the deevice 
            printPower(deviceInfo.UDN,deviceInfo.friendlyName,binaryState, instantPower, data)
          });

        }catch(err){
          console.error("%s %s",new Date().toISOString(),err);
        }
      }
    });
    
  }catch(err){
    console.error("%s %s",new Date().toISOString(),err);
  }

  //set a timer to re-try discovery every 10 seconds (10,000msec) 
  setTimeout(triggerDiscovery, 10000);
} // end triggerDiscovery


//  printPower is a function that writes a line of the device's state 
function printPower(UDN,friendlyName,binaryState, instantPower, data){

  // create a text time stamp
  var ts=new Date().toISOString();

  //log on the console stdout
  console.log("%s %s,%s,%s,%s,%j",ts,UDN,friendlyName,binaryState,instantPower,data);

  //write locally 
  if (WRITE_LOCAL) writeToFile(ts,UDN,friendlyName,binaryState,instantPower,data);
} // end printPower


// write the data to a file
function writeToFile(ts,UDN,friendlyName,binaryState, instantPower, data){
  //1 file per hour
  //example ts=2017-06-20T18:51:19.105Z
  var filename = 'mlv_' + ts.substring(0,13) + '.log';
  var line=util.format("%s %s,%s,%s,%s,%j\n",ts,UDN,friendlyName,binaryState,instantPower,data);
  fs.appendFileSync(filename, line, {'flags': 'a'});
} //end writeToFile


// check the wifi name 
function checkWiFi(){
  console.log("in checkWiFi");
  wifiName().then(name => {
          console.log(name);    //=> 'wu-tang lan' 
        });
  sleep(30000);
} // end checkWiFi

// from https://www.sitepoint.com/delay-sleep-pause-wait/ 
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
} // end sleep  


