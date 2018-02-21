/*
  Send a command to write to a MiFare card
*/

// Global variables for the reader
var api, reader, context;

// Data to be written
var startingBlock = 5;
var chunkSize = 4;
var maxStringLength = 16;
var API = GoogleSmartCard.PcscLiteClient.API;

function onStartup() {
  console.log("Establishing connection with app...");
  apiContext = new GoogleSmartCard.PcscLiteClient.Context("CloudTags NFC Listener");
  apiContext.addOnInitializedCallback(function(initializedApi) {
    console.log("Connection established and API initialized. Establishing PC/SC Context...");
    api = initializedApi;
    api.SCardEstablishContext(API.SCARD_SCOPE_SYSTEM, null, null).then(function(result){
      result.get(function(establishedCardContext) {
        console.log("Context established. Finding readers...")
        context = establishedCardContext;
        api.SCardListReaders(context, null).then(function(result) {
          result.get(function(readers) {
            console.log("Readers found. List of readers: " + readers);
            console.log("Using " + readers[0]);
            reader = readers[0];
            listenForCards();
          }, function(error) {
            console.log("Error listing readers.")
          })
        })
      }, function(error) {
        console.log("Error establishing context.")
      });
    })
  });
  apiContext.initialize();
}
function listenForCards() {
  console.log("Listening for cards...");
  api.SCardGetStatusChange(context, 31536000, [API.createSCardReaderStateIn(reader, API.SCARD_STATE_EMPTY)]).then(function(result){
    result.get(function(result) {
      console.log("Card found. Connecting to reader...");
      api.SCardConnect(context, reader, API.SCARD_SHARE_SHARED, API.SCARD_PROTOCOL_ANY).then(function(result) {
        myResult = result;
        result.get(function(handle, protocol) {
          if(!!writeData()) {
            writeToCard(handle, protocol, writeData())
          }
          else {
            readFromCard(handle, protocol);
          }
        }, function(error) {
          showError("Error when card inserted.")
        })
      })
    }, function(error) {
      showError("Error finding card.")
    })
  });
}

function waitToRestart() {
    console.log("Waiting for card removal...");
  api.SCardGetStatusChange(context, 31536000, [API.createSCardReaderStateIn(reader, API.SCARD_STATE_PRESENT)]).then(function(result){
    result.get(function(result) {
      console.log("Card removed. Restarting listener...");
      listenForCards();
    }, function(error) {
      showError("Error finding card.")
    })
  });
}

function writeToCard(cardHandle, protocol, string, block) {
  console.log("Connected to reader. Writing to card...")
  block = block || startingBlock;
  // Get the write command
  var command = [0xFF, 0xD6, 0x00, block, chunkSize].concat(encodeData(
    string.substring((block - startingBlock) * chunkSize, (block - startingBlock + 1) * chunkSize)));
  api.SCardTransmit(cardHandle, getProtocol(protocol), command).then(function(result) {
    result.get(function(response, secondResponse) {
      // Calls the result success
      // Writes in chunks
      console.log("Wrote from blocks " + (block) + " to "  + (block+4))
      if(block < maxStringLength) {
        writeToCard(cardHandle, protocol, string, block + 1)
      }
      else {
        onCardWrite(string);
      }
    }, function(error) {
      console.log("Error writing blocks: " + error);
      // Calls the result error
    })
  });
}
function readFromCard(cardHandle, protocol) {
  console.log("Connected to reader. Reading from card...")
  // Get the read command
  var command = [0xFF, 0xB0, 0x00, startingBlock, 0x10];
  api.SCardTransmit(cardHandle, getProtocol(protocol), command).then(function(result) {
    result.get(function(responseProtocol, responseData) {
      // Calls the result success
      onCardRead(decodeData(responseData.splice(0, responseData.length - 2)))
    }, function(result) {
      // Calls the result error
    })
  });
}
// Performs the on read actions
function onCardRead(value) {
  waitToRestart();
  showSuccess("Successfully read data: " + value);
  postToServer(value);
}
// Displays a success message when a card is written
function onCardWrite(value) {
  waitToRestart();
  showSuccess("Successfully wrote value: " + value);
  document.querySelector("#write-value").value = "";
}

function postToServer(value) {
  var url = !!document.querySelector("#is-development:checked") ? "http://cloudtags-api-staging.herokuapp.com" : "http://cloudtags-api-production.herokuapp.com"
  url += "/kiosks/" + document.querySelector("#kiosk-id").value
  var data = {event: "nfc_tap", data: { tag_data: value }};
  $.ajax({
    type: "POST",
    beforeSend: function(request) {
      request.setRequestHeader('Content-Type', 'application/json');
      request.setRequestHeader("X-API-ID", document.querySelector("#client-id").value)
      request.setRequestHeader("X-API-KEY", document.querySelector("#api-key").value)
    },
    url: url,
    data: JSON.stringify(data),
    processData: false,
    success: function(message) {
      console.log(message)
    }
  });
}

// Displays a read or write error
function onError(errorCode) {
  
}
// Encodes a string into a byte array
function encodeData(string) {
  var toReturn = string.split("").map(function(value) {
    return value.charCodeAt(0) & 0xff;
  });
  // Pads the string out with spaces
  while(toReturn.length < 16) {
    toReturn.push(" ".charCodeAt(0) & 0xff)
  }
  return toReturn;
}

// Decodes a string from a byte array
function decodeData(arr) {
  return arr.map(function(value) {
    return String.fromCharCode(value)
  }).join("").trim();
}
// Gets the transmit protocol from the reader
function getProtocol(protocol) {
  return protocol == API.SCARD_PROTOCOL_T0 ? API.SCARD_PCI_T0 : API.SCARD_PCI_T1;
}

// Get the write value

// Flash a success message
function showSuccess(message) {
  document.querySelector("#success-message").innerHTML = message;
  document.querySelector("#success-message").style.display = 'block';
  setTimeout(function(){
    document.querySelector("#success-message").style.display = 'none';
  }, 5000)
}
// Flash an error message
function showError(message) {
  document.querySelector("#error-message").innerHTML = message;
  document.querySelector("#error-message").style.display = 'block';
  setTimeout(function(){
    document.querySelector("#error-message").style.display = 'none';
  }, 5000)
}

// Start the screen
onStartup();
