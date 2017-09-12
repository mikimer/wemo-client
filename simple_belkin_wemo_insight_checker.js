
// Mike is modified the Javascript file to read and write data from a Belkin Wemo Insight plug 
// Original file in: https://github.com/mimizone/wemo-client 
// discovers Wemo Insight switches, listens to power information, writes data to local file 

// npm libraries for general operation 
var Wemo = require('wemo-client');
var util = require('util');
var fs = require('fs');
var wifiName = require('wifi-name');

// declare variables 
var wemo = new Wemo();
var name = 'undefined wifi'; 

// THIS IS THE MAIN() FUNCTION 
console.log('Starting to look for Belkin Wemo Insight Switches');

// double check the wifi network to remind the user 
checkWiFi();

try{
    triggerDiscovery();
  }
catch(err){
  console.log("something went wrong"); 
  console.error("%s %s",new Date().toISOString(),err);
}
// end the MAIN() SECTION

// begin declaring functions


// try to discover the Wemos every 10sec in case a device falls off the network. 
function triggerDiscovery(){

  //announce the discovery process
  console.log("%s INFO discovering Wemo switches",new Date().toISOString());

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
  writeToFile(ts,UDN,friendlyName,binaryState,instantPower,data);
} // end printPower


// write the data to a file
function writeToFile(ts,UDN,friendlyName,binaryState, instantPower, data){
  //1 file per hour
  //example ts=2017-06-20T18:51:19.105Z
  var filename = ts.substring(0,13) + '.log';
  var line=util.format("%s %s,%s,%s,%s,%j\n",ts,UDN,friendlyName,binaryState,instantPower,data);
  fs.appendFileSync(filename, line, {'flags': 'a'});
} //end writeToFile


// check the wifi name 
function checkWiFi(){
  wifiName().then(name => {
          console.log('');    
          console.log('REMINDER: This app is looking for Belkin Wemos on:');
          console.log(name);    //=> 'wu-tang lan' 
          console.log('Your Belkin Wemos must be on this network or this app cannot find them.');
          console.log('');     
        });
} // end checkWiFi

