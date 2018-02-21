window.onload = function() {
  webview = document.querySelector("webview")
  var cloudtagsNfc = new CloudTagsNfc({
    onRead: function(value) {
      webview.executeScript({code: `document.dispatchEvent(new CustomEvent('nfc_tap', { detail: {tag_data: '${value}' }}))`, runAt: 'document_end' })
    },
    onWrite: function(value) {
        document.querySelector("#write-value").value = "";
        document.querySelector("#success-message").innerHTML = "<strong>Wrote: </strong>" + value;
        document.querySelector("#success-message").style.display = 'block';
        setTimeout(function(){
          document.querySelector("#success-message").style.display = 'none';
        }, 5000)

    },
    onReadError: function(value) {
      webview.executeScript({code: `document.dispatchEvent(new CustomEvent('nfc_error', { detail: {tag_data: '${value}' }}))`, runAt: 'document_end' })
    },
    onWriteError: function(value) {
        document.querySelector("#write-value").value = "";

        document.querySelector("#error-message").innerHTML = "<strong>Error: </strong>" + value;;
        document.querySelector("#error-message").style.display = 'block';
        setTimeout(function(){
          document.querySelector("#error-message").style.display = 'none';
        }, 5000)
    },
    getWriteData: function() {
      return document.querySelector("#write-value").value
    },
  });

  webview.addEventListener('loadcommit', function(e) {
   webview.insertCSS({code: "#nfc-panel { display: block !important }" })
  });
  $("#is-development").click(function(){
    if($("#is-development:checked").length > 0) {
      webview.setAttribute("src", "https://cloudtags-api-staging.herokuapp.com")
    }
    else {
      webview.setAttribute("src", "https://cloudtags-api-production.herokuapp.com")
    }
  })
}
