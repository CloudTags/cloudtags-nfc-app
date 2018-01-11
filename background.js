chrome.app.runtime.onLaunched.addListener(function(){
  chrome.app.window.create("app.html", {
    id: 'appWindow',
    outerBounds: { width: 500, height: 300 }
  })
});
