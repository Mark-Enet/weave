// ── SERVICENOW OAUTH 2.0 (PKCE) + REST ─────────────────────────────────────

var SN_CONFIG_KEY = 'weave-sn-config';
var SN_TOKEN_KEY  = 'weave-sn-token';
var SN_PKCE_KEY   = 'weave-sn-pkce';   // sessionStorage — cleared on tab close

// ── CONFIG ─────────────────────────────────────────────────────────────────
function snLoadConfig() {
  try { return JSON.parse(localStorage.getItem(SN_CONFIG_KEY)) || {}; }
  catch(e) { return {}; }
}
function snSaveConfig(cfg) {
  localStorage.setItem(SN_CONFIG_KEY, JSON.stringify(cfg));
}

// ── TOKEN STORAGE ──────────────────────────────────────────────────────────
function snSaveToken(data) {
  var token = {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt:    Date.now() + ((data.expires_in || 1800) * 1000) - 60000,
    scope:        data.scope || ''
  };
  localStorage.setItem(SN_TOKEN_KEY, JSON.stringify(token));
  return token;
}
function snLoadToken() {
  try { return JSON.parse(localStorage.getItem(SN_TOKEN_KEY)); }
  catch(e) { return null; }
}
function snClearToken() {
  localStorage.removeItem(SN_TOKEN_KEY);
  sessionStorage.removeItem(SN_PKCE_KEY);
}

// ── PKCE HELPERS ───────────────────────────────────────────────────────────
function snB64url(buf) {
  var bytes = new Uint8Array(buf);
  var str = '';
  bytes.forEach(function(b) { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function snGenerateVerifier() {
  var arr = new Uint8Array(96);
  crypto.getRandomValues(arr);
  return snB64url(arr);
}
function snGenerateChallenge(verifier) {
  var enc = new TextEncoder();
  var data = enc.encode(verifier);
  return crypto.subtle.digest('SHA-256', data).then(function(hash) {
    return snB64url(hash);
  });
}
function snGenerateState() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return snB64url(arr);
}

// ── OAUTH FLOW ─────────────────────────────────────────────────────────────
function snInitLogin() {
  var cfg = snLoadConfig();
  if (!cfg.instanceUrl || !cfg.clientId) {
    snOpenConfig();
    return;
  }
  var verifier   = snGenerateVerifier();
  snGenerateChallenge(verifier).then(function(challenge) {
    var state       = snGenerateState();
    var redirectUri = window.location.href.split('?')[0].split('#')[0];
    sessionStorage.setItem(SN_PKCE_KEY, JSON.stringify({
      verifier:    verifier,
      state:       state,
      redirectUri: redirectUri
    }));
    var base   = cfg.instanceUrl.replace(/\/$/, '');
    var params = new URLSearchParams({
      response_type:         'code',
      client_id:             cfg.clientId,
      redirect_uri:          redirectUri,
      state:                 state,
      code_challenge:        challenge,
      code_challenge_method: 'S256'
    });
    if (cfg.scope) params.set('scope', cfg.scope);
    window.location.href = base + '/oauth_auth.do?' + params.toString();
  });
}

function snHandleCallback() {
  var params = new URLSearchParams(window.location.search);
  var code   = params.get('code');
  var state  = params.get('state');
  var error  = params.get('error');

  if (error) {
    // Validate against known OAuth error codes to avoid reflecting arbitrary input
    var knownErrors = ['access_denied','invalid_request','unauthorized_client',
      'unsupported_response_type','invalid_scope','server_error','temporarily_unavailable'];
    var safeError = knownErrors.indexOf(String(error)) !== -1 ? String(error) : 'unknown_error';
    toast('ServiceNow auth error: ' + safeError, '\u2715');
    history.replaceState(null, '', window.location.pathname);
    return Promise.resolve(false);
  }
  if (!code) return Promise.resolve(false);

  var pkce;
  try { pkce = JSON.parse(sessionStorage.getItem(SN_PKCE_KEY)); }
  catch(e) { pkce = null; }

  if (!pkce || pkce.state !== state) {
    toast('OAuth state mismatch \u2014 possible CSRF', '\u2715');
    history.replaceState(null, '', window.location.pathname);
    return Promise.resolve(false);
  }

  var cfg  = snLoadConfig();
  var base = cfg.instanceUrl.replace(/\/$/, '');
  var body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     cfg.clientId,
    code:          code,
    redirect_uri:  pkce.redirectUri,
    code_verifier: pkce.verifier
  });

  return fetch(base + '/oauth_token.do', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString()
  }).then(function(resp) {
    if (!resp.ok) {
      return resp.text().then(function(txt) { throw new Error(txt); });
    }
    return resp.json();
  }).then(function(data) {
    snSaveToken(data);
    sessionStorage.removeItem(SN_PKCE_KEY);
    history.replaceState(null, '', window.location.pathname);
    toast('Connected to ServiceNow \u2713', '\u2713');
    snUpdateBannerBtn();
    snUpdatePanelStatus();
    return true;
  }).catch(function(e) {
    toast('ServiceNow auth failed: ' + e.message, '\u2715');
    history.replaceState(null, '', window.location.pathname);
    return false;
  });
}

function snRefreshAccessToken() {
  var tok = snLoadToken();
  if (!tok || !tok.refreshToken) return Promise.resolve(null);
  var cfg  = snLoadConfig();
  var base = cfg.instanceUrl.replace(/\/$/, '');
  var body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     cfg.clientId,
    refresh_token: tok.refreshToken
  });
  return fetch(base + '/oauth_token.do', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString()
  }).then(function(resp) {
    if (!resp.ok) throw new Error('refresh failed');
    return resp.json();
  }).then(function(data) {
    return snSaveToken(data);
  }).catch(function() {
    snClearToken();
    snUpdateBannerBtn();
    snUpdatePanelStatus();
    return null;
  });
}

function snGetValidToken() {
  var tok = snLoadToken();
  if (!tok) return Promise.resolve(null);
  if (Date.now() < tok.expiresAt) return Promise.resolve(tok.accessToken);
  return snRefreshAccessToken().then(function(t) {
    return t ? t.accessToken : null;
  });
}

function snLogout() {
  snClearToken();
  snUpdateBannerBtn();
  snUpdatePanelStatus();
  snCloseBannerMenu();
  toast('Disconnected from ServiceNow', '\u2713');
}

// ── REST API ───────────────────────────────────────────────────────────────
function snApiGet(path, queryParams) {
  return snGetValidToken().then(function(token) {
    if (!token) {
      toast('Not connected to ServiceNow', '!');
      return null;
    }
    var cfg  = snLoadConfig();
    var base = cfg.instanceUrl.replace(/\/$/, '');
    var url  = base + path;
    if (queryParams) {
      url += '?' + new URLSearchParams(queryParams).toString();
    }
    return fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept':        'application/json'
      }
    });
  }).then(function(resp) {
    if (!resp) return null;
    if (!resp.ok) {
      return resp.text().then(function(txt) {
        throw new Error(resp.status + ': ' + txt);
      });
    }
    return resp.json();
  });
}

// ── STATE HELPERS ──────────────────────────────────────────────────────────
function snIsLoggedIn() {
  var tok = snLoadToken();
  return !!(tok && tok.accessToken);
}

// ── BANNER BUTTON ──────────────────────────────────────────────────────────
function snUpdateBannerBtn() {
  var btn = document.getElementById('sn-banner-btn');
  if (!btn) return;
  var loggedIn = snIsLoggedIn();
  var cfg = snLoadConfig();
  var label = loggedIn
    ? '<span class="sn-dot connected" title="Connected"></span>ServiceNow'
    : 'ServiceNow';
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<rect x="2" y="3" width="20" height="14" rx="2"/>' +
    '<path d="M8 21h8M12 17v4"/></svg>' +
    label;
  btn.title = loggedIn
    ? 'Connected to ServiceNow (' + (cfg.instanceUrl || '') + ')'
    : 'Connect to ServiceNow';
}

function snBannerClick() {
  if (snIsLoggedIn()) {
    var menu = document.getElementById('sn-menu');
    if (menu.style.display === 'block') {
      snCloseBannerMenu();
    } else {
      menu.style.display = 'block';
    }
  } else {
    snOpenConfig();
  }
}

function snCloseBannerMenu() {
  var menu = document.getElementById('sn-menu');
  if (menu) menu.style.display = 'none';
}

// ── CONFIG MODAL ───────────────────────────────────────────────────────────
function snOpenConfig() {
  var cfg = snLoadConfig();
  document.getElementById('sn-instance-url').value = cfg.instanceUrl || '';
  document.getElementById('sn-client-id').value    = cfg.clientId    || '';
  document.getElementById('sn-scope').value        = cfg.scope       || 'useraccount';
  var hint = document.getElementById('sn-redirect-uri-hint');
  if (hint) hint.textContent = window.location.href.split('?')[0].split('#')[0];
  document.getElementById('sn-config-modal').classList.add('open');
}
function snCloseConfig() {
  document.getElementById('sn-config-modal').classList.remove('open');
}
function snSaveConfigUI() {
  var instanceUrl = document.getElementById('sn-instance-url').value.trim();
  var clientId    = document.getElementById('sn-client-id').value.trim();
  var scope       = document.getElementById('sn-scope').value.trim();
  if (!instanceUrl || !clientId) {
    toast('Instance URL and Client ID are required', '!');
    return;
  }
  // Normalise instance URL
  if (!/^https?:\/\//i.test(instanceUrl)) instanceUrl = 'https://' + instanceUrl;
  instanceUrl = instanceUrl.replace(/\/$/, '');
  snSaveConfig({ instanceUrl: instanceUrl, clientId: clientId, scope: scope });
  snCloseConfig();
  toast('ServiceNow config saved', '\u2713');
  snUpdateBannerBtn();
}

// ── PANEL STATUS ───────────────────────────────────────────────────────────
function snUpdatePanelStatus() {
  var statusEl  = document.getElementById('sn-panel-status');
  var formEl    = document.getElementById('sn-query-form');
  var loginEl   = document.getElementById('sn-panel-login');
  if (!statusEl) return;

  var loggedIn = snIsLoggedIn();
  var cfg      = snLoadConfig();

  if (loggedIn) {
    var instanceLabel = cfg.instanceUrl || '';
    statusEl.innerHTML =
      '<span class="sn-dot connected"></span>' +
      '<span class="sn-status-text">Connected to <strong>' + esc(instanceLabel) + '</strong></span>';
    if (formEl)  formEl.style.display  = '';
    if (loginEl) loginEl.style.display = 'none';
  } else {
    statusEl.innerHTML = '<span class="sn-dot"></span><span class="sn-status-text">Not connected</span>';
    if (formEl)  formEl.style.display  = 'none';
    if (loginEl) loginEl.style.display = '';
  }
}

// ── QUERY PANEL ────────────────────────────────────────────────────────────
function snRunQuery() {
  var table      = document.getElementById('sn-table').value.trim();
  var query      = document.getElementById('sn-query').value.trim();
  var fields     = document.getElementById('sn-fields').value.trim();
  var limit      = parseInt(document.getElementById('sn-limit').value) || 20;
  var sysField   = document.getElementById('sn-sys-field').value.trim();
  var actorField = document.getElementById('sn-actor-field').value.trim();
  var tsField    = document.getElementById('sn-ts-field').value.trim();

  if (!table) { toast('Table name is required', '!'); return; }

  var params = {
    sysparm_limit:         limit,
    sysparm_display_value: 'true'
  };
  if (query)  params.sysparm_query  = query;
  if (fields) params.sysparm_fields = fields;

  var statusEl = document.getElementById('sn-query-status');
  var resultsEl = document.getElementById('sn-results');
  statusEl.textContent = 'Querying\u2026';
  document.getElementById('sn-import-all-btn').style.display = 'none';
  resultsEl.innerHTML = '';
  resultsEl._records = null;

  snApiGet('/api/now/table/' + encodeURIComponent(table), params)
    .then(function(data) {
      if (!data) { statusEl.textContent = ''; return; }
      var records = data.result || [];
      statusEl.textContent = records.length + ' record(s) returned';
      snShowResults(records, table, sysField, actorField, tsField);
    })
    .catch(function(e) {
      statusEl.textContent = 'Error: ' + e.message;
      toast('Query failed: ' + e.message, '\u2715');
    });
}

function snGetFieldVal(rec, field) {
  if (!field) return '';
  var v = rec[field];
  if (!v) return '';
  return (typeof v === 'object' && v.display_value != null) ? v.display_value : String(v);
}

// Extract a human-readable description from a ServiceNow record
function snGetRecordDesc(rec, fallback) {
  var raw = rec.short_description || rec.description || rec.name || rec.number || rec.sys_id || fallback || '(record)';
  return (typeof raw === 'object' && raw.display_value != null) ? raw.display_value : String(raw);
}

// Generate a cryptographically random hex suffix for IDs
function snRandomSuffix() {
  var arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function snShowResults(records, table, sysField, actorField, tsField) {
  var el = document.getElementById('sn-results');
  el._records    = records;
  el._table      = table;
  el._sysField   = sysField;
  el._actorField = actorField;
  el._tsField    = tsField;

  if (!records.length) {
    el.innerHTML = '<div class="hint" style="padding:8px 0">No records found.</div>';
    return;
  }
  var html = '<div class="sn-result-list">';
  records.forEach(function(rec, i) {
    var desc  = snGetRecordDesc(rec, '(record ' + (i + 1) + ')');
    var sys   = sysField   ? snGetFieldVal(rec, sysField)   : table;
    var actor   = actorField ? snGetFieldVal(rec, actorField) : '';
    var ts      = tsField    ? snGetFieldVal(rec, tsField)    : (snGetFieldVal(rec, 'sys_created_on') || '');
    html += '<div class="sn-result-item" id="snri-' + i + '">';
    html += '<div class="sn-result-desc">' + esc(desc) + '</div>';
    html += '<div class="sn-result-meta">';
    if (sys)   html += '<span class="sn-result-sys">' + esc(sys) + '</span>';
    if (actor) html += '<span class="sn-result-actor">' + esc(actor) + '</span>';
    if (ts)    html += '<span class="sn-result-ts">' + esc(ts) + '</span>';
    html += '</div>';
    html += '<button class="btn btn-outline btn-sm sn-add-btn" id="sn-add-' + i + '" onclick="snImportRecord(' + i + ')">+ Add</button>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
  document.getElementById('sn-import-all-btn').style.display = 'inline-flex';
}

function snImportRecord(idx) {
  var el  = document.getElementById('sn-results');
  var rec = (el._records || [])[idx];
  if (!rec) return;
  snRecordToEvent(rec, el._table, el._sysField, el._actorField, el._tsField);
  var item = document.getElementById('snri-' + idx);
  var btn  = document.getElementById('sn-add-' + idx);
  if (item) item.classList.add('sn-imported');
  if (btn)  { btn.textContent = '\u2713 Added'; btn.disabled = true; }
}

function snImportAll() {
  var el      = document.getElementById('sn-results');
  var records = el._records || [];
  if (!records.length) return;
  records.forEach(function(rec, i) {
    snRecordToEvent(rec, el._table, el._sysField, el._actorField, el._tsField);
    var item = document.getElementById('snri-' + i);
    var btn  = document.getElementById('sn-add-' + i);
    if (item) item.classList.add('sn-imported');
    if (btn)  { btn.textContent = '\u2713 Added'; btn.disabled = true; }
  });
  document.getElementById('sn-import-all-btn').style.display = 'none';
  toast(records.length + ' record(s) imported', '\u2191');
}

function snRecordToEvent(rec, table, sysField, actorField, tsField) {
  var desc  = snGetRecordDesc(rec);
  var sys   = sysField   ? snGetFieldVal(rec, sysField)   : table;
  var actor   = actorField ? snGetFieldVal(rec, actorField) : '';
  var tsRaw   = tsField    ? snGetFieldVal(rec, tsField)    : (snGetFieldVal(rec, 'sys_created_on') || '');
  var tsMs    = null;
  if (tsRaw) {
    var d = new Date(tsRaw.replace(' ', 'T'));
    if (!isNaN(d.getTime())) tsMs = d.getTime();
  }
  var ev = {
    _id:          'sn-' + (rec.sys_id || Date.now()) + '-' + snRandomSuffix(),
    desc:         desc,
    system:       sys   || table,
    actor:        actor || '',
    timestamp:    tsMs,
    interactions: [],
    mode:         appMode
  };
  events.push(ev);
  if (ev.system) knownSys.add(ev.system);
  refreshDL();
  render();
  updateList();
}

// ── INIT ───────────────────────────────────────────────────────────────────
function snInit() {
  // Close SN menu when clicking outside
  document.addEventListener('click', function(e) {
    var menu = document.getElementById('sn-menu');
    if (!menu) return;
    var btn  = document.getElementById('sn-banner-btn');
    if (menu.style.display === 'block' &&
        !menu.contains(e.target) &&
        btn && !btn.contains(e.target)) {
      snCloseBannerMenu();
    }
  });

  // Handle OAuth callback (page loaded with ?code=...)
  if (window.location.search.indexOf('code=') !== -1 ||
      window.location.search.indexOf('error=') !== -1) {
    snHandleCallback().then(function() {
      snUpdateBannerBtn();
      snUpdatePanelStatus();
    });
  } else {
    snUpdateBannerBtn();
    snUpdatePanelStatus();
  }
}
