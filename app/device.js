/* Public Tizen application APIs. No Mac server, network address or credentials. */
(function () {
  'use strict';
  var IDS = {
    stremio: 'IkWsFHtOY9.Stremio', tizentube: 'xvvl3S1bvH.TizenBrewStandalone', browser: 'org.tizen.browser',
    netflix: 'org.tizen.netflix-app',
    disneyplus: 'MCmYXNxgcu.DisneyPlus', youtube: '9Ur5IzDKqV.TizenYouTube',
    appletv: 'com.samsung.tv.aria-video', primevideo: 'org.tizen.primevideo',
    applemusic: 'org.tizen.apple.apple-music'
  };
  /* Ranked after the primary apps in All apps. Confirm IDs from this TV's app list. */
  var STREAMING = ['5b8c3eb16b.BeamCTVDev', '3KA0pm7a7V.TubiTV', 'rJeHak5zRg.Spotify'];
  /* Apps whose store ID varies by region: matched by name on this TV. */
  var NAMES = { mewatch: /^me ?watch$/i, livetv: /^(live ?tv|tv)$/i };
  /* Live TV's ID differs between firmware versions: also matched by ID pattern (never Samsung TV Plus). */
  var ID_MATCH = { livetv: /tv-?viewer|live-?tv/i };
  var LIVE_HINT = /viewer|tuner|live|channel|epg|source/i;
  var CONSUMER_SYSTEM = ['org.tizen.browser', 'com.microsoft.copilot'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '5b8c3eb16b.BeamCTVDev': 'hbomax', '3KA0pm7a7V.TubiTV': 'tubi'};
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
    'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices'];
  var SELF = 'GzIyAIxWae.CleanFrame';
  function api() { return window.tizen && window.tizen.application; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  function launchApp(id, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
    catch (err) { finish(failure(err)); }
  }
  /* Open an app as CleanFrame's callee: asking for a reply makes the TV treat CleanFrame
     as the caller, so exiting the app can return here instead of to Samsung Home.
     Apps that refuse app control fall back to a plain launch. */
  var REPLY = { onsuccess: function () {}, onfailure: function () {} };
  var NO_APP_CONTROL = ['NotFoundError', 'InvalidValuesError', 'NotSupportedError'];
  function openApp(id, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    function plain() {
      try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
      catch (err) { finish(failure(err)); }
    }
    try {
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, []);
      api().launchAppControl(control, id, function () { finish(null); }, function (err) {
        if (err && NO_APP_CONTROL.indexOf(err.name) >= 0) plain(); else finish(failure(err));
      }, REPLY);
    } catch (err) { plain(); }
  }
  function launch(brand, done) {
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], done);
  }
  function art(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      var data = [new tizen.ApplicationControlData('mode', ['fullscreen']), new tizen.ApplicationControlData('requester', ['mobile'])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, 'org.tizen.art-app', function () { finish(null); }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  /* TizenBrew opens one of its modules directly when asked through app control. */
  function launchModule(id, moduleName, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      var data = [new tizen.ApplicationControlData('module', [JSON.stringify({ moduleName: moduleName, moduleType: 'npm', args: '' })])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, id, function () { finish(null); }, function (err) { finish(failure(err)); }, REPLY);
    } catch (err) { finish(failure(err)); }
  }
  function home(done) { launchApp('com.samsung.tv.csfs', done); }
  function settings(done) { launchApp('com.samsung.tv.coba.setting', done); }
  /* TizenBrew Installer's TV app: installs CleanFrame updates from GitHub with Host PC IP left at 127.0.0.1. */
  function installer(done) {
    launchApp('xvvl3S1bTI.TizenBrewStandalone', function (err) {
      done(err ? { message: 'TizenBrew Installer isn\u2019t on this TV yet.', detail: 'Install it once from your PC: Install TizenBrew Installer.' } : null);
    });
  }
  function apps(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      api().getAppsInfo(function (list) {
        var known = {}, seen = {}, result = [], youtubeApp = list.some(function (a) { return a.id === IDS.youtube; });
        Object.keys(IDS).forEach(function (brand) { known[IDS[brand]] = brand; });
        /* Some regions ship YouTube only under the Cobalt ID. */
        if (!youtubeApp) known['com.samsung.tv.cobalt-yt'] = 'youtube';
        list.forEach(function (a) {
          Object.keys(NAMES).forEach(function (brand) { if (!known[a.id] && a.name && NAMES[brand].test(a.name)) known[a.id] = brand; });
          Object.keys(ID_MATCH).forEach(function (brand) { if (!known[a.id] && ID_MATCH[brand].test(a.id) && !/plus/i.test(a.id + ' ' + a.name)) known[a.id] = brand; });
          var primary = !!known[a.id], stream = STREAMING.indexOf(a.id) >= 0;
          var consumer = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(a.id) || CONSUMER_SYSTEM.indexOf(a.id) >= 0;
          /* The Disney+ remote-button app (CleanFrame Button) borrows Disney+'s ID; never list it. */
          if (a.id === IDS.disneyplus && /cleanframe/i.test(a.name || '')) return;
          if (a.id === SELF || INTERNAL.indexOf(a.id) >= 0 || seen[a.id] || !a.name || (!primary && !stream && (!a.show || !consumer))) return;
          if (!primary && /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon)/i.test(a.name + ' ' + a.id)) return;
          if (/-dummy$/.test(a.id) || (a.id === 'com.samsung.tv.cobalt-yt' && youtubeApp)) return;
          seen[a.id] = true;
          result.push({ appId: a.id, name: a.name, brand: known[a.id] || EXTRA_BRANDS[a.id] || '', icon: a.iconPath || '', rank: primary ? (IDS[known[a.id]] ? Object.keys(IDS).indexOf(known[a.id]) : 0) : (stream ? 20 : 30) });
        });
        result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
        /* Diary: which app is Live TV on this TV, and the likely candidates if none matched. */
        var live = result.filter(function (r) { return r.brand === 'livetv'; })[0];
        if (live) note('Live TV is ' + live.appId);
        else note('Live TV not found. Candidates: ' + (list.filter(function (a) { return LIVE_HINT.test(a.id + ' ' + (a.name || '')); }).map(function (a) { return a.id; }).join(', ') || 'none'));
        finish(null, result);
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  /* Test only (0.7.4): record what the TV announces about apps becoming active or inactive,
     and when CleanFrame itself is shown or hidden. Nothing acts on these yet. */
  var EVENTS_KEY = 'cleanframe.events.v1', events = [], listeners = [];
  try { events = JSON.parse(localStorage.getItem(EVENTS_KEY)) || []; } catch (e) { events = []; }
  function note(text) {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    events.push(pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' \u00b7 ' + text);
    if (events.length > 40) events = events.slice(events.length - 40);
    try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  (function watch() {
    var a = api();
    if (!a) return;
    if (typeof a.addAppStatusChangeListener !== 'function') { note('TV has no app event feature'); return; }
    try {
      a.addAppStatusChangeListener(function (id, active) { note((active ? 'ACTIVE ' : 'inactive ') + id); });
      note('Listening for app events');
    } catch (err) { note('App events refused: ' + (err && (err.name + ' ' + err.message))); }
    document.addEventListener('visibilitychange', function () { note(document.hidden ? 'CleanFrame hidden' : 'CleanFrame shown'); });
  }());
  /* Auto-return: the TV sends no event when an app closes, so ask it about three times a second whether
     the app CleanFrame opened is still running. Once it has gone, call back. Apps that stay
     running in the background (Netflix) never trigger it. Watching ends when CleanFrame is
     shown again or another app is opened from it. */
  /* RESTART: TizenBrew closes and reopens itself when CleanFrame opens a module, so a close in the
     first few seconds is that restart, not the person leaving. */
  var BREW_APP = 'xvvl3S1bvH.TizenBrewStandalone', watch = null, POLL = 300, NEVER_SEEN = 30000, RESTART = 6000, GIVE_UP = 4 * 60 * 60 * 1000;
  function stopWatch(reason) {
    if (!watch) return;
    clearInterval(watch.timer);
    if (reason) note(reason);
    watch = null;
  }
  function watchApp(id, name, onClosed) {
    var a = api();
    stopWatch();
    if (!a || typeof a.getAppsContext !== 'function') return;
    var w = watch = { id: id, seen: false, started: Date.now(), timer: 0 };
    note('Watching ' + name);
    w.timer = setInterval(function () {
      if (watch !== w) return;
      try {
        a.getAppsContext(function (list) {
          if (watch !== w) return;
          var running = list.some(function (c) { return c.appId === id; });
          if (running) { w.seen = true; if (Date.now() - w.started > GIVE_UP) stopWatch('Stopped watching ' + name + ' after 4 hours'); return; }
          if (id === BREW_APP && w.seen && Date.now() - w.started < RESTART) { w.seen = false; return; }
          if (!w.seen) { if (Date.now() - w.started > NEVER_SEEN) stopWatch('Stopped watching ' + name + ' (never saw it run)'); return; }
          stopWatch(name + ' closed, returning');
          onClosed();
        }, function () {});
      } catch (e) { stopWatch('Watching stopped: ' + e.message); }
    }, POLL);
  }
  function bringBack(done) { launchApp(SELF, function (err) { note(err ? 'Return failed: ' + (err.detail || err.message) : 'Returned to CleanFrame'); if (done) done(err); }); }
  /* Internet opened any other way (Smart Hub, Apps list, a remote button): while CleanFrame is
     in the background with auto-return on, also watch the browser. If it closes and no other
     app has started since, come back. If another app has started, the browser was probably
     closed by the TV to free memory while that app is on screen, so stay put. */
  var AMBIENT = { 'org.tizen.browser': 'Internet' }, ambient = null, ambientOn = false;
  function userApps(list) {
    return list.map(function (c) { return c.appId; }).filter(function (id) {
      return id !== SELF && !/^com\.samsung\./.test(id) && !/Service$/i.test(id);
    });
  }
  function stopAmbient() { if (ambient) { clearInterval(ambient.timer); ambient = null; } }
  function startAmbient() {
    var a = api();
    stopAmbient();
    if (!ambientOn || !a || typeof a.getAppsContext !== 'function') return;
    var w = ambient = { seen: {}, timer: 0 };
    w.timer = setInterval(function () {
      if (ambient !== w) return;
      try {
        a.getAppsContext(function (list) {
          if (ambient !== w) return;
          var apps = userApps(list);
          Object.keys(AMBIENT).forEach(function (id) {
            if (ambient !== w || (watch && watch.id === id)) return;
            var running = apps.indexOf(id) >= 0;
            if (running) { if (!w.seen[id]) w.seen[id] = apps.slice(); return; }
            if (!w.seen[id]) return;
            var before = w.seen[id], newer = apps.filter(function (x) { return before.indexOf(x) < 0; });
            delete w.seen[id];
            if (newer.length) { note(AMBIENT[id] + ' closed while ' + newer[0] + ' was open, staying put'); return; }
            note(AMBIENT[id] + ' closed, returning');
            stopAmbient(); stopWatch();
            bringBack();
          });
        }, function () {});
      } catch (e) { stopAmbient(); }
    }, POLL);
  }
  function setAmbient(on) { ambientOn = !!on; if (!ambientOn) stopAmbient(); else if (document.hidden) startAmbient(); }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { stopWatch(); stopAmbient(); } else startAmbient();
  });
  /* One-press update: ask TizenBrew Installer's background service on this TV (its local
     WebSocket on port 8091, the same channel its own screen uses) to install the latest
     GitHub release. Every failure carries a short "what to try" so the person can fix it. */
  var INSTALLER_APP = 'xvvl3S1bTI.TizenBrewStandalone', INSTALLER_SERVICE = 'xvvl3S1bTI.InstallerService', INSTALLER_WS = 'ws://127.0.0.1:8091';
  var UPDATE_STEPS = { 'installStatus.fetching': 'Downloading the latest release from GitHub…', 'installStatus.resigning': 'Signing it with your certificate…',
    'installStatus.parsing': 'Checking the package…', 'installStatus.installing': 'Installing… CleanFrame will close in a moment.', 'installStatus.installed': 'Installed.' };
  function updateError(raw, repo) {
    var text = String(raw || '');
    if (/debuggingNotEnabled/.test(text)) return { message: 'TizenBrew Installer can’t reach the TV’s developer connection.',
      detail: 'Check Host PC IP is 127.0.0.1 (Apps > App Settings > 12345), then hold Power until the Samsung logo appears and try again.' };
    if (/GitHub|release/i.test(text)) return { message: 'Couldn’t get the release from GitHub.',
      detail: 'Make the repo ' + repo + ' public (GitHub > Settings > Change visibility), check the TV is online, then try again. Or install from a USB stick.' };
    if (/certificate|author|signature/i.test(text)) return { message: 'The new version’s certificate doesn’t match the installed one.',
      detail: 'Delete CleanFrame from Apps, then open TizenBrew Installer and use Install from GitHub. Your Home layout resets.' };
    if (/resign/i.test(text)) return { message: 'TizenBrew Installer couldn’t sign the update.',
      detail: 'Open TizenBrew Installer, use Install from GitHub once and sign in to Samsung if asked, then try again.' };
    return { message: 'The update didn’t install.', detail: (text ? text.slice(0, 120) + ' · ' : '') + 'Try Install from GitHub in TizenBrew Installer, or install from a USB stick.' };
  }
  function updateFromGitHub(repo, onStatus, done) {
    var finished = false, socket = null, attempts = 0, started = Date.now(), sentAt = 0, resent = false, timer;
    function finish(err) { if (finished) return; finished = true; clearInterval(timer); try { if (socket) socket.close(); } catch (e) {} done(err); }
    if (typeof WebSocket === 'undefined') { finish({ message: 'This TV can’t talk to TizenBrew Installer.', detail: 'Open TizenBrew Installer and use Install from GitHub with ' + repo + '.' }); return; }
    function send() { sentAt = Date.now(); socket.send(JSON.stringify({ type: 1, payload: { url: repo } })); }
    function connect() {
      attempts++;
      try { socket = new WebSocket(INSTALLER_WS); } catch (e) { socket = null; return; }
      socket.onopen = function () { onStatus('Asking TizenBrew Installer for the latest release…'); send(); };
      socket.onmessage = function (event) {
        var msg; try { msg = JSON.parse(event.data); } catch (e) { return; }
        if (msg.type === 4) { onStatus(UPDATE_STEPS[msg.payload] || 'Working…'); if (msg.payload === 'installStatus.installed') finish(null); }
        else if (msg.type === 3) finish(updateError(msg.payload, repo));
        else if (msg.type === 1 && msg.payload) {
          if (msg.payload.response === 2) finish({ message: 'TizenBrew Installer has no Samsung certificate yet.',
            detail: 'Open TizenBrew Installer, use Install from GitHub once and sign in to Samsung, then try again.' });
          else if (msg.payload.response === 0 && /install failed/i.test(String(msg.payload.result || ''))) finish(updateError(msg.payload.result, repo));
          else if (msg.payload.response === 0) finish(null);
        }
      };
      socket.onclose = function () { socket = null; };
      socket.onerror = function () {};
    }
    function startInstaller() {
      var a = api();
      if (!a) return;
      /* Start only the installer's background service; opening the installer app would hide
         CleanFrame and leave the request stranded. */
      try { a.launch(INSTALLER_SERVICE, function () {}, function (err) {
        if (err && err.name === 'NotFoundError') finish({ message: 'TizenBrew Installer isn’t on this TV.',
          detail: 'Install it once from your PC (Install TizenBrew Installer), or update CleanFrame from a USB stick.' });
      }); } catch (e) {}
    }
    connect();
    timer = setInterval(function () {
      if (finished) return;
      if (!socket && attempts === 1) { onStatus('Starting TizenBrew Installer…'); startInstaller(); }
      if (!socket && Date.now() - started < 12000) { connect(); return; }
      if (socket && socket.readyState === 1 && sentAt && !resent && Date.now() - sentAt > 6000) { resent = true; send(); return; }
      if (!sentAt && Date.now() - started > 12000) finish({ message: 'Couldn’t start TizenBrew Installer in the background.',
        detail: 'Open TizenBrew Installer from Apps, press Back to return here, then choose Update CleanFrame again. If that fails, use Install from GitHub in the installer.' });
      if (sentAt && Date.now() - started > 180000) finish({ message: 'TizenBrew Installer stopped answering.',
        detail: 'Check Host PC IP is 127.0.0.1 and the repo is public, then try again. Or use Install from GitHub in the installer.' });
    }, 1500);
  }
  function eventLog() { return events.slice(); }
  function clearEvents() { events = []; try { localStorage.removeItem(EVENTS_KEY); } catch (e) {} note('Events cleared'); }
  function onEvent(fn) { listeners.push(fn); }
  window.FrameDevice = { launch: launch, launchApp: launchApp, openApp: openApp, launchModule: launchModule, installer: installer, note: note, eventLog: eventLog, watchApp: watchApp, updateFromGitHub: updateFromGitHub, stopWatch: stopWatch, setAmbient: setAmbient, bringBack: bringBack, clearEvents: clearEvents, onEvent: onEvent, art: art, home: home, settings: settings, apps: apps };
}());
