var Wemo = require('wemo-client');
var wemo = new Wemo();

function printPower(UDN,friendlyName,binaryState, instantPower, data){
  console.log("%s %s,%s,%s,%smw,%j",new Date().toISOString(),UDN,friendlyName,binaryState,instantPower,data);
}

function triggerDiscovery(){
  console.log("%s INFO discovering Wemo switches",new Date().toISOString());
  wemo.discover(function (err,deviceInfo){
      if (deviceInfo !=null 
        && deviceInfo.deviceType=="urn:Belkin:device:insight:1"
        && deviceInfo.UDN != null){
        console.log("%s INFO discovered:%s,%s",new Date().toISOString(),deviceInfo.UDN,deviceInfo.friendlyName);
        try{
          var client=wemo.client(deviceInfo);
          client.on('insightParams', function(binaryState, instantPower, data){
            printPower(deviceInfo.UDN,deviceInfo.friendlyName,binaryState, instantPower, data)
          });
        }catch(err){
          console.error("%s %s",new Date().toISOString(),err);
        }
      }
    }
  );
  setTimeout(triggerDiscovery, 10000);
}


try{
  process.on('uncaughtException', function (er) {
    console.error(er.stack)
    process.exit(1);
  })

  triggerDiscovery();
}catch(err){
  console.error("%s %s",new Date().toISOString(),err);
}