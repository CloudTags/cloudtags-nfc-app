chrome.usb.getDevices({vendorId: "1839", productId: "8763"}, function(devices) {
  console.log(devices);
})