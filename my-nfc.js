class CloudTagsNfc {
  constructor(callbacks) {
    this.onRead = callbacks.onRead;
    this.onWrite = callbacks.onWrite;

    this.onReadError = callbacks.onReadError;
    this.onWriteError = callbacks.onWriteError;

    this.getWriteData = callbacks.getWriteData;
    this._start()

    // Data to be written
    this.startingBlock = 5;
    this.chunkSize = 4;
    this.maxStringLength = 16;
    this.API = GoogleSmartCard.PcscLiteClient.API;
  }
  _start() {
    var self = this;
    // Use the SmartCard API to connect to the NFC reader
    this.apiContext = new GoogleSmartCard.PcscLiteClient.Context("CloudTags NFC Listener");

    // Initialize the reader
    this.apiContext.addOnInitializedCallback(function(initializedApi) {
      self.api = initializedApi;
      // Connect to the port and list the available reader
      self.api.SCardEstablishContext(self.API.SCARD_SCOPE_SYSTEM, null, null).then(function(result){
        result.get(function(establishedCardContext) {
          self.context = establishedCardContext;
          // Use the first available reader
          self.api.SCardListReaders(self.context, null).then(function(result) {
            result.get(function(readers) {
              self.reader = readers[0];
              self._listen();
            }, function(error) {
              console.log("Error listing readers.")
            })
          })
        }, function(error) {
          console.log("Error establishing context.")
        });
      })
    });
    this.apiContext.initialize();
  }

  _listen() {
    var self = this;
    console.log("Listening for cards...");
    this.api.SCardGetStatusChange(self.context, 31536000, [self.API.createSCardReaderStateIn(self.reader, self.API.SCARD_STATE_EMPTY)]).then(function(result){
      result.get(function(result) {
        console.log("Card found. Connecting to reader...");
        self.api.SCardConnect(self.context, self.reader, self.API.SCARD_SHARE_SHARED, self.API.SCARD_PROTOCOL_ANY).then(function(result) {
          result.get(function(handle, protocol) {
            if(!!self.getWriteData()) {
              self._write(handle, protocol, self.getWriteData())
            }
            else {
              self._read(handle, protocol);
            }
          }, function(error) {
            self.onError("Error when card inserted.")
          })
        })
      }, function(error) {
        self.onError("Error finding card.")
      })
    });
  }

  _wait() {
    var self = this;
    // When a card is inserted, wait for the card to be removed before starting the reading logic again
    self.api.SCardGetStatusChange(self.context, 31536000, [self.API.createSCardReaderStateIn(self.reader, self.API.SCARD_STATE_PRESENT)]).then(function(result){
      result.get(function(result) {
        // When a card is removed, restart the listening process
        self._listen();
      }, function(error) {
        self._onError("Error finding card.")
      })
    });
  }

  _write(cardHandle, protocol, string, block) {
    var self = this;
    block = block || self.startingBlock;
    // Get the write command
    var command = [0xFF, 0xD6, 0x00, block, self.chunkSize].concat(self._encodeData(
      string.substring((block - self.startingBlock) * self.chunkSize, (block - self.startingBlock + 1) * self.chunkSize)));
    self.api.SCardTransmit(cardHandle, self._getProtocol(protocol), command).then(function(result) {
      result.get(function(response, secondResponse) {
        // Calls the result success
        // Writes in chunks
        if(block < self.maxStringLength) {
          self._write(cardHandle, protocol, string, block + 1)
        }
        else {
          self._wait();
          self.onWrite(string);
        }
      }, function(error) {
        console.log("Error writing blocks: " + error);
        self.onWriteError(error.message);
      })
    });
  }
  _read(cardHandle, protocol) {
    var self = this;
    console.log("Connected to reader. Reading from card...")
    // Get the read command
    var command = [0xFF, 0xB0, 0x00, self.startingBlock, 0x10];
    self.api.SCardTransmit(cardHandle, self._getProtocol(protocol), command).then(function(result) {
      result.get(function(responseProtocol, responseData) {
        // Calls the result success
        self._wait();
        self.onRead(self._decodeData(responseData.splice(0, responseData.length - 2)))
      }, function(result) {
        // Calls the result error
        console.log("Error reading blocks: " + error);
        self.onReadError(error.message);
      })
    });
  }
  _getProtocol(protocol) {
    return protocol == this.API.SCARD_PROTOCOL_T0 ? this.API.SCARD_PCI_T0 : this.API.SCARD_PCI_T1;
  }
  _decodeData(arr) {
    return arr.map(function(value) {
      return String.fromCharCode(value)
    }).join("").trim();
  }
  _encodeData(string) {
    var toReturn = string.split("").map(function(value) {
      return value.charCodeAt(0) & 0xff;
    });
    // Pads the string out with spaces
    while(toReturn.length < 16) {
      toReturn.push(" ".charCodeAt(0) & 0xff)
    }
    return toReturn;
  }
}