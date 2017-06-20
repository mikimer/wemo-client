
// discovers Wemo Insight switches, listens to power information, writes data to local file AND/OR Google spreadsheet
// command: node insight.js [--google] [--nolocal]
// --google: write data to a Google Spreadsheet (Experimental...)
// --nolocal: don't write data to a local file (one per hour)


var Wemo = require('wemo-client');
var util = require('util');
//npm install command-line-args
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
  { name: 'google', alias: 'g', type: Boolean },
  { name: 'nolocal', alias: 'n', type: Boolean}
];
const options = commandLineArgs(optionDefinitions);
const WRITE_LOCAL= !options["nolocal"];

//allows to write to an existing Google Spreadsheet. It is still buggy in the edge cases though...
//requires to install the following:
//npm install googleapis --save
//npm install google-auth-library --save
const WRITE_TO_GOOGLE=options["google"];

var wemo = new Wemo();


//for Google Drive
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
//cache of multiple measures to write in batch to gdrive 
var queue=[];

function printPower(UDN,friendlyName,binaryState, instantPower, data){
  var ts=new Date().toISOString();

  //log on the console stdout
  console.log("%s %s,%s,%s,%s,%j",ts,UDN,friendlyName,binaryState,instantPower,data);

  //cache new entry for google drive
  if (WRITE_TO_GOOGLE) queue.push([ts,friendlyName,instantPower]);

  //write locally
  if (WRITE_LOCAL) writeToFile(ts,UDN,friendlyName,binaryState,instantPower,data);
}

function triggerDiscovery(oauth2Client){
  console.log("%s INFO discovering Wemo switches",new Date().toISOString());
  try{
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
    });
    
  }catch(err){
    console.error("%s %s",new Date().toISOString(),err);
  }
  setTimeout(triggerDiscovery, 10000);
}


function writeToFile(ts,UDN,friendlyName,binaryState, instantPower, data){
  //1 file per hour
  //example ts=2017-06-20T18:51:19.105Z
  var filename = ts.substring(0,13) + '.log';
  var line=util.format("%s %s,%s,%s,%s,%j\n",ts,UDN,friendlyName,binaryState,instantPower,data);
  fs.appendFileSync(filename, line, {'flags': 'a'});
}

//-----------------------------------------------------

//var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}


function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.error('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}


//write all the rows in the given array
function writeToDrive(oauth2Client){
  var data=queue;
  //SPREADSHEET: 1lUstzodzzziKhnLtvcnRhBhKO0sDKOr3yObSDPLplsI
  var sheets = google.sheets('v4');
  var request = {
    spreadsheetId: '1lUstzodzzziKhnLtvcnRhBhKO0sDKOr3yObSDPLplsI', //TODO it should be dynamic and created as needed when data grows
    range: 'Sheet1',
    includeValuesInResponse: 'true',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource:{
      "values": data
    },
    auth: oauth2Client
  };

  // sheets.spreadsheets.values.get({spreadsheetId: '1lUstzodzzziKhnLtvcnRhBhKO0sDKOr3yObSDPLplsI',
  //   range: 'Sheet1',auth: oauth2Client}, function(err, response){
  //     if (err) {
  //       console.error(err);
  //       return;
  //     }
  //   }
  // );

  console.log("%s Writing %s rows to Google drives",new Date().toISOString(),data.length);
  sheets.spreadsheets.values.append(request, function(err, response) {
      if (err) {
        console.error(err);
        return;
      }
      queue=queue.slice(data.length,queue.length);
      console.log("%s remaining rows in the queue:%s",new Date().toISOString(),queue.length);
    }
  );
}

//write to Google API in batch to respect rate limits
function batchWriteToDrive(oauth2Client){
  //Google Sheet API Quota: 100req/100s per user.
  if (queue.length > 0){
    writeToDrive(oauth2Client);
  }
  setTimeout(function(){
    batchWriteToDrive(oauth2Client)
    },3000
  );
}
//-----------------------------------------------------


try{
  process.on('uncaughtException', function (er) {
    console.error("%s %s",new Date().toISOString(),er.stack)
    //process.exit(1);
  })

  //requires to have the Google API credentials in the client_secret.json file
  if (WRITE_TO_GOOGLE){
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
      if (err) {
        console.error('Error loading client secret file: ' + err);
        return;
      }
      authorize(JSON.parse(content), function(oauth2Client){
        batchWriteToDrive(oauth2Client);
        triggerDiscovery();
      }); //blocking until authorized via the prompted URL on the first time
    });
  }else{
    triggerDiscovery();
  }
}catch(err){
  console.error("%s %s",new Date().toISOString(),err);
}

