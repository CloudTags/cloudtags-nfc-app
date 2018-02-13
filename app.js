window.onload = function() {
  webview = document.querySelector("webview")
  var cloudtagsNfc = new CloudTagsNfc({
    onRead: function(value) {
      webview.executeScript({code: `document.dispatchEvent(new CustomEvent('nfc_tap', { detail: {tag_data: '${value}' }}))`, runAt: 'document_end' })
    },
    onWrite: function(value) {
      webview.executeScript({code: `document.dispatchEvent(new CustomEvent('nfc_write', { detail: {tag_data: '${value}' }}))`, runAt: 'document_end' })
    },
    onError: function(value) {
      webview.executeScript({code: `document.dispatchEvent(new CustomEvent('nfc_error', { detail: {tag_data: '${value}' }}))`, runAt: 'document_end' })
    }
  });

  webview.addEventListener('loadcommit', function(e) {
   webview.insertCSS({code: "#nfc-panel { display: block !important }" })
  });
}
