import PostsView from './views/Posts';
import ToastsView from './views/Toasts';
import idb from 'idb';

export default function IndexController(container) {
  this._container = container;
  this._postsView = new PostsView(this._container);
  this._toastsView = new ToastsView(this._container);
  this._lostConnectionToast = null;
  this._openSocket();
  this._registerServiceWorker();
}

//let's go
/* service worker life cycle
  reg.unregister();
  reg.update();
  reg.installing;
  reg.waiting;
  reg.active;
  reg.addEventListener('updatefound', function() {
    // reg.installing has changed
  })
  var sw = reg.installing;
  console.log(sw.state); //... logs 'installing'
    // state can also be: 'installed'
    // 'activating'
    // 'activated' <- sw is ready to receive fetch events
    // 'redundant' <- sw has been thrown away

  sw fires an event statechange wheneve the value of the state property changes.
  sw.addEventListener('statechange', function() {
    // sw.state has changed
  })

  'navigator.serviceWorker.controller' refers to the sw that controls this page

  if (!navigator.serviceWorker.controller) {
    // page didn't load using a sw
  }

  if (reg.waiting) {
    // there's an update ready!
  }
  if (reg.installing) {
    // there's an update in progress
    reg.installing.addEventListener('statechange', function() {
      if (this.state = 'installed') {
        // there's an update ready!
      }
    })
  }

  reg.addEventListener('updatefound', function() {
    reg.installing.addEventListener('statechange', function() {
      if(this.state == 'installed') {
        // there's an update ready!
      }
    })
  })
*/

IndexController.prototype._registerServiceWorker = function() {
  if (!navigator.serviceWorker) return;

  var indexController = this;

  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    // TODO: if there's no controller, this page wasn't loaded
    // via a service worker, so they're looking at the latest version.
    // In that case, exit early
    if (!navigator.serviceWorker.controller) {
      return;
    }
    // TODO: if there's an updated worker already waiting, call
    // indexController._updateReady()
    if (reg.waiting) {
      indexController._updateReady();
      return;
    }
    // TODO: if there's an updated worker installing, track its
    // progress. If it becomes "installed", call
    // indexController._updateReady()
    if (reg.installing) {
      // indexController._trackInstalling(reg.installing);
      var sw = reg.installing;
      sw.addEventListener('statechange', function() {
        if (sw.state == 'installed') {
          indexController._updateReady();
        }
      })
      return;
    }

    reg.addEventListener('updatefound', function() {
      // indexController._trackInstalling(reg.installing);
      var sw = reg.installing;
      sw.addEventListener('statechange', function() {
        if (sw.state == 'installed') {
          indexController._updateReady();
        }
      })
    });
  });
};

IndexController.prototype._updateReady = function() {
  var toast = this._toastsView.show("New version available", {
    buttons: ['whatever']
  });
};

// open a connection to the server for live updates
IndexController.prototype._openSocket = function() {
  var indexController = this;
  var latestPostDate = this._postsView.getLatestPostDate();

  // create a url pointing to /updates with the ws protocol
  var socketUrl = new URL('/updates', window.location);
  socketUrl.protocol = 'ws';

  if (latestPostDate) {
    socketUrl.search = 'since=' + latestPostDate.valueOf();
  }

  // this is a little hack for the settings page's tests,
  // it isn't needed for Wittr
  socketUrl.search += '&' + location.search.slice(1);

  var ws = new WebSocket(socketUrl.href);

  // add listeners
  ws.addEventListener('open', function() {
    if (indexController._lostConnectionToast) {
      indexController._lostConnectionToast.hide();
    }
  });

  ws.addEventListener('message', function(event) {
    requestAnimationFrame(function() {
      indexController._onSocketMessage(event.data);
    });
  });

  ws.addEventListener('close', function() {
    // tell the user
    if (!indexController._lostConnectionToast) {
      indexController._lostConnectionToast = indexController._toastsView.show("Unable to connect. Retrying…");
    }

    // try and reconnect in 5 seconds
    setTimeout(function() {
      indexController._openSocket();
    }, 5000);
  });
};

// called when the web socket sends message data
IndexController.prototype._onSocketMessage = function(data) {
  var messages = JSON.parse(data);
  this._postsView.addPosts(messages);
};
