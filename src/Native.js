import Observable from './Observable';

/**
 * @param connection
 * @constructor
 */
function Native(connection) {
    this._session = null;
    this._host = "127.0.0.1";
    this._port = "8080";
    this._available_ports = ["8080", "8081", "8082"];
    this._available_https_ports = ["8443", "8444", "8445"];

    this._realm = null;
    this._extension = null;

    this._sip_host = null;
    this._sip_port = null;
    this._sip_password = null;

    this._registered = false;
    this._calls = [];

    this._recon_time = 0;
    this._recon_timeout = false;
    this._recon_timeout_min = 3;
    this._recon_timeout_max = 6;
    this._recon_timeout_skip = 360;
    this._recon_inactivity = 45;
    this._verify_time = false;
    this._verify_timeout = 5;

    this._con_request = null;
    this._con_requests_time = [];
    this._con_secs = 0;
    this._con_wait = 30;
    this._con_errors = [];
    this._con_reconnect = false;

    this._connected = false;
    this._connecting = false;

    // Initialize supper
    Observable.call(this);
};

Native.prototype = Object.create(Observable.prototype);

// ============================================================
// Public events
// ============================================================

/**
 * Indicates that WebAPI are successfully connected to a softphone daemon
 *
 * @event connected
 */

/**
 * Indicates that error occurs during a communication with softphone daemon
 *
 * @event disconnected
 */

/**
 * Indicates that the connection was broken hand manually
 *
 * @event disconnected_manual
 */

/**
 * Indicates that softphone is registered and able to initiate a calls.
 *
 * @event registration_success
 */

/**
 * Indicates that softphone can not register.
 *
 * @event registration_failure
 */

/**
 * Indicates a new call is available.
 *
 * @event call_created
 */

/**
 * Indicates that call was changed (call status)
 *
 * @event call_changed
 */

/**
 * Indicates that call was terminated
 *
 * @event call_terminated
 */

// ============================================================
// Public functions
// ============================================================

/**
 * @public
 */
Native.prototype.connect = function(port, realm, extension) {
    if (this._con_reconnect || this._connecting || this._connected) {
        return;
    }

    this._port = port;
    this._realm = realm;
    this._extension = extension;

    this._con_reconnect = true;

    if (port != null) {
        this._port = port;

        this._connect();
    }

    this._verify();
};

/**
 * @public
 */
Native.prototype.disconnect = function() {
    // Execute exit action
    if (window.XMLHttpRequest && this._host && this._port && this._session) {
        var url = this._host +":"+ this._port +"/disconnect?session=" + this._session + "";
        var request = new XMLHttpRequest();
        request.open('GET', url, true);  // `true` makes the request asynchronous
        request.send(null);
    }

    // Destroy connection
    this._con_reconnect = false;
    this._disconnect(true);
};

/**
 * @public
 */
Native.prototype.isConnected = function() {
    return this._connected;
};

/**
 * @public
 */
Native.prototype.isVerified = function() {
    return this._con_reconnect;
};

/**
 * @public
 */
Native.prototype.sessions = function(callback, scope) {
    var url = this._host +":"+ this._port + "/sessions";
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.broadcast = function(message, callback, scope) {
    var url = this._host +":"+ this._port + "/broadcast?message=" + encodeURIComponent(message);
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.send = function(id, message, callback, scope) {
    var url = this._host +":"+ this._port + "/send?id=" + encodeURIComponent(id) + "&message=" + encodeURIComponent(message);
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.set = function(key, value, callback, scope) {
    var url = this._host +":"+ this._port + "/set?key="+ encodeURIComponent(key) +"&value=" + encodeURIComponent(value);
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.get = function(key, callback, scope) {
    var url = this._host +":"+ this._port + "/get?key="+ encodeURIComponent(key);
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.start = function(application, callback, scope) {
    var url = this._host +":"+ this._port + "/start?app=" + encodeURIComponent(application);
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.startVpn = function(host, port, caCrt, clientKey, clientCrt, taKey, callback, scope) {
    this._post(
        this._host +":"+ this._port +"/start",
        "app=openvpn&host="+ encodeURIComponent(host) +"&port="+ encodeURIComponent(port) +"&ca_crt="+ encodeURIComponent(caCrt) +"&client_key="+ encodeURIComponent(clientKey) +"&client_crt="+ encodeURIComponent(clientCrt) +"&ta_key="+ encodeURIComponent(taKey) +"",
        this._proxy(callback, scope),
        this._onError
    );
};

/**
 * @public
 */
Native.prototype.stopVpn = function(callback, scope) {
    var url = this._host +":"+ this._port + "/command?service=vpn&cmd=stop_config";
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.statusVpn = function(callback, scope) {
    var url = this._host +":"+ this._port + "/command?service=vpn&cmd=status";
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.check = function(callback, scope, ports) {
    if (ports == undefined) {
        ports = window.location.protocol == "https:" ? this._available_https_ports.slice(0) : this._available_ports.slice(0)
    } else if (ports.length == 0) {
        return callback.call(scope, false);
    }

    var me = this;
    var next = ports.shift();
    var proxy = function(port, status) {
        if (status) {
            me._port = port;
            callback.call(scope, port);
        } else {
            me.check(callback, scope, ports);
        }
    };

    this.checkPort(next, proxy, scope);
};

/**
 * @public
 */
Native.prototype.checkPort = function(port, callback, scope) {
    var url = this._host +":"+ port +"/ping";
    var success = function() {
        callback.call(scope, port, true);
    };
    var failure = function() {
        callback.call(scope, port, false);
    };

    this._request("GET", url, "", success, failure, 1000);
};

/**
 * @public
 */
Native.prototype.refreshSettings = function(callback, scope) {
    var url = this._host +":"+ this._port +"/settings?session=" + this._session  + "&action=refresh";
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.getSettings = function(callback, scope) {
    var url = this._host +":"+ this._port +"/settings?session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.setSetting = function(key, value, callback, scope) {
    var url = this._host +":"+ this._port +"/settings?session=" + this._session  + "&action=set" + "&config=" + key + "&value=" + value;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.register = function(host, port, password, callback, scope) {
    this._post(
            this._host +":"+ this._port +"/register?session="+ encodeURIComponent(this._session),
            "session="+ encodeURIComponent(this._session) +"&host="+ encodeURIComponent(host) +"&port="+ encodeURIComponent(port) +"&password="+ encodeURIComponent(password) +"",
        this._proxy(callback, scope),
        this._onError
    );
};


/**
 * @public
 */
Native.prototype.unregister = function(callback, scope) {
    this._post(
            this._host +":"+ this._port +"/unregister?session="+ encodeURIComponent(this._session),
            "session="+ encodeURIComponent(this._session) + "",
        this._proxy(callback, scope),
        this._onError
    );
};

/**
 * @public
 */
Native.prototype.call = function(number, callback, scope) {
    var url = this._host +":"+ this._port +"/originate?number="+ encodeURIComponent(number) +"&session=" + this._session;
    var cb = function(response) {
        if (!response['success'] || response['success'] == "false") {
            callback.call(scope, null, response['reason']);
            return;
        }

        var id = response['data']['id'];
        var params = {
            'id': id,
            'callee_number': number,
            'callee_name': number,
            'duration': 0,
            'direction': 'outgoing',
            'quality': 0,
            'status': 'outgoinginit'
        };
        var call = SoftPhoneCall.fromObject(params);

        this._calls.push(call);
        this._fire("call_created", call);

        callback.call(scope, call);
    };

    this._get(url, this._proxy(cb, this), this._onError);
};

/**
 * @public
 */
Native.prototype.callViaSession = function(number, session, callback, scope) {
    var url = this._host +":"+ this._port +"/originate?number="+ encodeURIComponent(number) +"&session=" + session;
    var cb = function(response) {
        if (!response['success'] || response['success'] == "false") {
            callback.call(scope, null, response['reason']);
            return;
        }

        var id = response['data']['id'];
        var params = {
            'id': id,
            'callee_number': number,
            'callee_name': number,
            'duration': 0,
            'direction': 'outgoing',
            'quality': 0,
            'status': 'outgoinginit'
        };
        var call = SoftPhoneCall.fromObject(params);

        this._calls.push(call);
        this._fire("call_created", call);

        callback.call(scope, call);
    };

    this._get(url, this._proxy(cb, this), this._onError);
};

/**
 * Put on hold a call
 */
Native.prototype.answer = function(call, callback, scope) {
    var url = this._host +":"+ this._port +"/answer?call="+ call.getId() +"&session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * Terminate a call
 */
Native.prototype.hangup = function(call, callback, scope) {
    var url = this._host +":"+ this._port +"/hangup?call="+ call.getId() +"&session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * Put on hold a specified call
 */
Native.prototype.hold = function(call, callback, scope) {
    var url = this._host +":"+ this._port +"/hold?call="+ call.getId() +"&session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * Put on hold a specified call
 */
Native.prototype.resume = function(call, callback, scope) {
    var url = this._host +":"+ this._port +"/unhold?call="+ call.getId() +"&session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * Send commands to softphone
 */
Native.prototype.dtmf = function(call, digit, callback, scope) {
    var url = this._host +":"+ this._port +"/dtmf?call="+ call.getId() +"&session=" + this._session + "&digit=" + digit;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * Mute the call
 */
Native.prototype.mute = function(call, callback, scope) {
    var url = this._host +":"+ this._port +"/mute?call="+ call.getId() +"&session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * Unmute the call
 */
Native.prototype.unmute = function(call, callback, scope) {
    var url = this._host +":"+ this._port +"/unmute?call="+ call.getId() +"&session=" + this._session;
    this._get(url, this._proxy(callback, scope), this._onError);
};

/**
 * @public
 */
Native.prototype.isConnected = function() {
    return this._connected;
};

/**
 * @public
 */
Native.prototype.isRegistered = function() {
    return this._registered;
};

/**
 * Returns a list of available calls.
 *
 * @access public
 * @returns {Array}
 */
Native.prototype.getCalls = function() {
    return this._calls.slice(0);
};

/**
 * Gets a call by a specified id.
 *
 * @access public
 * @returns {object} Or null when call not found
 */
Native.prototype.getCall = function(id) {
    for (var i=0; i < this._calls.length; i++) {
        if (this._calls[i].getId() == id) {
            return this._calls[i];
        }
    }

    return null;
};

// ============================================================
// Plugin callbacks
// ============================================================

/**
 * @private
 */
Native.prototype._connect = function() {
    if (this._connected){
        throw new Error("Attempt to connect when already connected");
    } else if (this._connecting){
        throw new Error("Attempt to connect when already connecting");
    }

    this._connecting = true;
    this._con_request = this._post(
            this._host +":"+ this._port +"/connect",
            "realm="+ encodeURIComponent(this._realm) +"&extension="+ encodeURIComponent(this._extension) +"",
        this._onInitiateResponse,
        this._onError
    );
};

/**
 * @private
 */
Native.prototype._disconnect = function(silent) {
    this._connected = false;
    this._connecting = false;

    if (this._con_request) {
        this._con_request.abort();
    }

    this._con_request = null;
    this._con_requests_time = [];


    for (var c=0; c < this._calls.length; c++) {
        this._fire("call_terminated", this._calls[c]);
    }

    this._registered = false;
    this._calls = [];

    if (!silent) {
        this._fire("disconnected", this._con_errors);
    } else {
        this._fire("disconnected_manual");
    }
};

/**
 * @private
 */
Native.prototype._onInitiateResponse = function(response) {
    try {
        var session = response['data']['session'];
        var calls = response['data']['calls'];
        var version = response['data']['version'];

        for (var i=0; i < calls.length; i++) {
            var call = SoftPhoneCall.fromObject(calls[i]);
            this._calls.push(call);
        }
    } catch (e) {
        this._con_errors.push(e);
        this._disconnect();
        return;
    }

    this._con_request = null;
    this._connected = true;
    this._connecting = false;
    this._session = session;
    this._version = version;
    this._bind();
    this._fire("connected");
};

/**
 * @private
 */
Native.prototype._bind = function() {
    if (!this._connected) {
        throw new Error("Attempt to bind when not connected");
    }
    if (this._con_request !== null) {
        throw new Error("Attempt to bind when another request are performing");
    }

    while (this._con_requests_time.length > 20) {
        this._con_requests_time.shift();
    }

    if (this._con_requests_time.length == 20) {
        var first = this._con_requests_time[0];
        var last = this._con_requests_time[this._con_requests_time.length - 1];
        var time = (last.getTime() - first.getTime()) / 1000;

        if (time < 5) {
            console.log("Too many requests between a short period of time (wait 2 seconds).", time);

            setTimeout(this._proxy(function() {
                this._con_requests_time.shift();
                this._bind()
            }, this), 2000);
            return;
        }
    }

    this._con_request = this._get(
            this._host +":" + this._port + "/bind?session=" + this._session,
        this._onBindResponse,
        this._onError
    );
    this._con_requests_time.push(new Date());
};

/**
 * @private
 */
Native.prototype._onBindResponse = function(data) {
    this._con_request = null;

    try {
        var events = this._parseBindResponse(data);
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            var name = event['event'];

            switch (name) {
                case "register":
                    this._processRegisterEvent(event);
                    break;
                case "call_confirmed":
                case "call_received":
                case "call_ringing":
                case "call_accepted":
                case "call_ack":
                case "call_calling":
                case "call_updating":
                case "call_terminated":
                case "call_failure":
                case "call_connecting":
                    this._processCallEvent(event);
                    break;
                case "hotkey_originate":
                    this._processHotKeyEvent(event);
                    break;
                case "carusto-vpn":
                    this._processVPNEvent(event);
                    break;
                case "send":
                case "broadcast":
                    this._processBroadcastEvent(event);
                    break;
                default:
                    console.error("Unhandled event", event);
            }

            this._fire("event", event);
        }
    } catch (e) {
        return this._onError(e);
    }

    this._bind();
};

/**
 * @private
 */
Native.prototype._parseBindResponse = function(data) {
    if (data && data['success'] == 'true') {
        if (!data['data'] || !data['data']['events']) {
            throw new Error("Invalid response from server");
        }

        return data['data']['events'];
    }

    throw new Error("Failed to retrieve events on a failure response");
};

/**
 * Fires when error occurs during connection to softphone daemon
 */
Native.prototype._onError = function(event) {
    this._con_errors.push(event);
    this._disconnect();
};

/**
 * Fires when softphone registration to server is changed.
 * We should fire registration_success or registration_failure event depnding on a status.
 */
Native.prototype._processRegisterEvent = function(event) {
    if (event['success'] == 'true') {
        this._fire("registration_success");
    } else {
        var reason = event['reason'];
        this._fire("registration_failure", reason);
    }
};

/**
 * Process a call event from softphone and generates a new ones.
 */
Native.prototype._processCallEvent = function(data) {
    var event = data['event'];
    var id = data['data']['id'];
    var call = this.getCall(id);

    switch (event) {
        case "call_received":
        case "call_ringing":
        case "call_accepted":
        case "call_ack":
        case "call_calling":
        case "call_confirmed":
        case "call_updating":
            var type = "call_changed";
            if (!call) {
                type = "call_created";
                call = SoftPhoneCall.fromObject(data['data']);

                this._calls.push(call);
            } else {
                call._update(data['data']);
            }

            this._fire(type, call);
            break;
        case "call_terminated":
        case "call_failure":
            var reason = data['reason'];
            if (!reason) {
                reason = "Terminated";
            }

            if (!call) {
                call = SoftPhoneCall.fromObject(data['data']);
                this._fire("call_created", call);
            } else {
                call._update(data['data']);
            }

            var filtered = [];
            for (var c=0; c < this._calls.length; c++) {
                var cl = this._calls[c];
                if (cl.getId() !== call.getId()) {
                    filtered.push(cl);
                }
            }

            this._calls = filtered;
            this._fire("call_terminated", call, reason);
            break;
    }
};

/**
 * Fires when
 * @param {String} data A selected text to call to.
 * @private
 */
Native.prototype._processHotKeyEvent = function(data) {
    var plain = decodeURIComponent(data['data']);
    var numbers = plain.replace(/[\s\(\)\[\]\{\}\-]/g,"").match(/\+?\d+/g);

    if (numbers) {
        for (var i=0; i < numbers.length; i++) {
            var number = numbers[i];

            if (/^\+?\d{6,13}$/.test(number)) {
                this._fire("hotkey", number);
                return;
            }
        }
    }
};

/**
 * Fires when
 * @param {String} data A selected text to call to.
 * @private
 */
Native.prototype._processVPNEvent = function(data) {
    this._fire("vpn", data);
};

/**
 * @private
 */
Native.prototype._processBroadcastEvent = function(data) {
    this._fire("broadcast", data);
};

// ============================================================
// Private functions
// ============================================================

/**
 * @private
 */
Native.prototype._get = function(url, success, failure) {
    return this._request("GET", url, "", success, failure);
};

/**
 * @private
 */
Native.prototype._post = function(url, params, success, failure) {
    return this._request("POST", url, params, success, failure);
};

/**
 * @private
 */
Native.prototype._request = function(method, url, params, success, failure, timeout) {
    var http = null;
    var me = this;
    if (window.XMLHttpRequest) {
        http = new XMLHttpRequest();
    } else {
        http = new ActiveXObject("Microsoft.http");
    }

    if (window.location.protocol == "https:") {
        url = "https://" + url;
    } else {
        url = "http://" + url;
    }

    if (method == 'POST') {
        http.open("POST", url, true);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    } else {
        http.open("GET", url, true);
    }

    http.onerror = function() {
        failure.call(me);
    };
    http.onreadystatechange = function() {
        if (http.readyState == 4 && http.status == 200) {
            var json = me._json(http.responseText);
            success.call(me, json);
        }
    };

    if (timeout) {
        http.timeout = timeout;
        http.ontimeout = function() {
            failure.call(me);
        };
    }

    if (method == 'POST') {
        http.send(params);
    } else {
        http.send();
    }

    return http;
};


/**
 * @private
 */
Native.prototype._json = function(response) {
    return eval("(function(){return " + response + ";})()");
};

/**
 * @private
 */
Native.prototype._verify = function() {
    if (this._con_reconnect) {
        var time = Math.round(new Date().getTime() / 1000);

        if (this._con_errors.length > 0) {
            this._con_errors = [];

            // Define reconnection timeout
            this._recon_time = this._verify_timeout;
            this._recon_timeout = this._random(this._recon_timeout_min, this._recon_timeout_max);
        } else if (this._connected == false && this._connecting == false) {
            if (this._recon_time) {
                if (this._recon_time >= this._recon_timeout) {
                    this.check(this._verifyCheckReconTimeout, this);
                } else {
                    this._recon_time += this._verify_timeout;
                }
            } else {
                this.check(this._verifyCheckReconTimeout, this);
            }
        } else if (this._connected == true) {
            this._con_secs += this._verify_timeout;

            // Solution to check if computer was in sleep mode or other problem occurs (browser doesn't execute javascript)
            if (this._verify_time) {
                var diff = Math.abs(time - this._verify_time);

                if (diff > this._con_wait) {
                    if (!this._connecting) {
                        this._con_errors.push("Found this computer was in sleep mode");
                        this._disconnect();
                    }
                }
            }
        }

        this._verify_time = time;
        setTimeout(this._proxy(this._verify, this), this._verify_timeout * 1000);
    }
};

/**
 * @private
 */
Native.prototype._verifyCheckReconTimeout = function(port) {
    if (port) {
        this._disconnect();
        this._port = port;
        this._connect();
    }
};

/**
 * Generates a random number in specified range.
 *
 * @private
 * @param from int
 * @param to int
 */
Native.prototype._random = function(from, to) {
    return Math.floor(Math.random() * (to - from + 1) + from);
};

/**
 * Wraps callback to be sure that function will be executed in proper scope
 *
 * @private
 * @param callback function
 * @param scope object
 */
Native.prototype._proxy = function(callback, scope) {
    return function() {
        callback.apply(scope, arguments);
    };
};


// ============================================================
// Shared classes
// ============================================================


function SoftPhoneCall(id) {
    this._className = 'SoftPhoneCall';
    this._id = id;
    this._calleeNumber = null;
    this._calleeName = null;
    this._duration = 0;
    this._durationTime = null;
    this._direction = null;
    this._status = null;
    this._quality = 0;
}

/**
 * @private
 */
SoftPhoneCall.fromObject = function(o) {
    var call = new SoftPhoneCall(o['id']);
    call._update(o);

    return call;
};

/**
 * Updates a call with a specified object
 *
 * @private
 */
SoftPhoneCall.prototype._update = function(o) {
    this._className = 'SoftPhoneCall';
    this._calleeNumber = o['callee_number'];
    this._calleeName = o['callee_name'];
    this._duration = o['duration'];
    this._durationTime = Math.round(new Date().getTime() / 1000);
    this._direction = o['direction'].toLowerCase();
    this._status = o['status'].toLowerCase();
    this._quality = parseInt(o['quality']);
};

/**
 * @public
 */
SoftPhoneCall.prototype.getClassName = function () {
    return this._className;
};

/**
 * Returns unique id of call.
 */
SoftPhoneCall.prototype.getId = function() {
    return this._id;
};

/**
 * Returns a duration of call in seconds.
 *
 * @public
 * @returns {int}
 */
SoftPhoneCall.prototype.getDuration = function() {
    var time = Math.round(new Date().getTime() / 1000);
    var offset = time - this._durationTime;
    return this._duration + offset;
};

/**
 * Returns a call quality from 1 to 5.
 */
SoftPhoneCall.prototype.getQuality = function() {
    return this._quality;
};

/**
 * Returns a duration in "MM:SS" format.
 *
 * @public
 * @returns {string}
 */
SoftPhoneCall.prototype.getFormattedDuration = function() {
    var seconds = this.getDuration();
    if (isNaN(seconds)) {
        return "00:00";
    }
    var hours = parseInt( seconds / 3600 ) % 24;
    var minutes = parseInt( seconds / 60 ) % 60;
    var result = "";
    seconds = seconds % 60;

    if (hours > 0) {
        result += (hours < 10 ? "0" + hours : hours) + ":";
    }

    result += (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds  < 10 ? "0" + seconds : seconds);
    return result;
};

/**
 * Returns the full name of the other participant.
 * Can be empty string when name is not available.
 *
 * @public
 * @returns {string}
 */
SoftPhoneCall.prototype.getCalleeName = function() {
    return this._calleeName;
};

/**
 * Returns the phone number of the other participant.
 *
 * @public
 * @returns {string}
 */
SoftPhoneCall.prototype.getCalleeNumber = function() {
    return this._calleeNumber;
};

/**
 * Returns a participant name in format "NAME (NUMBER)" or "NUMBER" when name is not available.
 *
 * @public
 * @returns {string}
 */
SoftPhoneCall.prototype.getFormattedCalleeName = function() {
    if (this._calleeName && this._calleeName.length > 0 && this._calleeName != this._calleeNumber) {
        return this._calleeName + " <"+ this._calleeNumber +">";
    }

    return this._calleeNumber;
};

/**
 * Returns a status of a call.
 * Possible call statuses:
 * idle
 * incomingreceived
 * outgoinginit
 * outgoingprogress
 * outgoingringing
 * outgoingearlymedia
 * connected
 * streamsrunning
 * pausing
 * paused
 * resuming
 * refered
 * error
 * end
 * pausedbyremote
 * updatedbyremote
 * incomingearlymedia
 * updating
 * released
 *
 * @public
 * @returns {string}
 */
SoftPhoneCall.prototype.getStatus = function() {
    return this._status;
};

/**
 * Returns status of a call.
 * Possible statuses:
 * - ringing
 * - active
 * - onhold
 * - terminated
 *
 * @returns {String}
 */
SoftPhoneCall.prototype.getSimpleStatus = function() {
    if (this.isActive()) {
        return "active";
    } else if (this.isRinging()) {
        return "ringing";
    } else if (this.isTerminated()) {
        return "terminated";
    } else {
        return "invalid";
    }
};

SoftPhoneCall.prototype.isRinging = function() {
    switch (this._status) {
        case "calling":
        case "incoming":
        case "early":
        case "connecting":
        case "outgoingringing":
        case "outgoingearlymedia":
        case "incomingearlymedia":
            return true;
        default:
            return false;
    }
};

SoftPhoneCall.prototype.isActive = function() {
    switch (this._status) {
        case "confirmed":
            return true;
        default:
            return false;
    }
};

SoftPhoneCall.prototype.isTerminated = function() {
    switch (this._status) {
        case "disconnected":
        case "terminated":
            return true;
        default:
            return false;
    }
};

/**
 * Gets a call direction.
 *
 * @returns {incoming|outgoing}
 */
SoftPhoneCall.prototype.getDirection = function() {
    return this._direction;
};

/**
 * Returns true if this call is incoming.
 *
 * @public
 * @returns {boolean}
 */
SoftPhoneCall.prototype.isIncoming = function() {
    return this._direction == "incoming";
};

/**
 * Returns true if this call is outgoing.
 *
 * @public
 * @returns {boolean}
 */
SoftPhoneCall.prototype.isOutgoing = function() {
    return this._direction == "outgoing";
};

export {
    Native,
    SoftPhoneCall
};