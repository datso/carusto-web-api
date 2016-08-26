'use strict';

import {
    JSJaCPresence,
    JSJaCWebSocketConnection,
    JSJaCHttpBindingConnection
} from '../include/jsjac';

import Observable from './Observable';

/**
 * Usage:
 *
 * var conn = new Connection("309180", "8qWAlyaS/kh8zwHPusM+jg==", "test", "http://192.168.50.146/xmpp/");
 * conn.connect();
 *
 * @constructor
 */
function Connection(uid, password, realm, url, wsUrl, options) {
    this._realm = realm;
    this._uid = uid;
    this._password = password;
    this._resource_prefix = 'web';
    this._resource_postfix = Math.round(Math.random()*10000);
    this._resource = this._makeResource(uid, password, this._resource_prefix, this._resource_postfix);
    this._jid = uid +"@"+ this._realm;
    this._jid_full = this._jid +"/"+ this._resource;
    this._sid = this._makeUniqueId(uid, password, 'wtapi');
    this._recon_time = 0;
    this._recon_timeout = false;
    this._recon_timeout_min = 2;
    this._recon_timeout_max = 16;
    this._recon_timeout_skip = 360;
    this._recon_inactivity = 45;
    this._verify_time = false;
    this._verify_timeout = 1;
    this._options = options;
    this._silent = options && options['silent'] ? true : false;

    this._con = false;
    this._con_id = 0;
    this._con_rid = false;
    this._con_secs = 0;
    this._con_errors = [];
    this._con_wait = 30;
    this._con_debuger = null;
    this._con_props = {
        httpbase: url,
        wait: this._con_wait,
        oDbg: this._con_debuger
    };
    this._con_ws_props = {
        httpbase: wsUrl,
        wait: this._con_wait,
        oDbg: this._con_debuger
    };
    this._connected = false;
    this._connecting = false;

    this.handlers = {};

    // Initialize supper
    Observable.call(this);

    // Initialize plugins
    for(var i=0; i < Connection.plugins.length; i++) {
        var plugin = Connection.plugins[i];
        this[plugin.name] = new plugin.cls(this);
    }

    this._verify();

    return this;
}

// ============================================================
// Public events
// ============================================================


/**
 * Indicates that connection to PBX is established
 *
 * @event Connection#connected
 */

/**
 * Indicates that connection with PBX is lost
 *
 * @event Connection#disconnected
 */


// ============================================================
// Static functionality
// ============================================================

Connection.prototype = Object.create(Observable.prototype);

Connection.plugins = [];

/**
 * @param {string} name Plugin name
 * @param {object} cls Plugin class (plugin prototype)
 */
Connection.addPlugin = function(name, cls) {
    var plugin = {
        name: name,
        cls: cls
    };
    Connection.plugins.push(plugin);
};

// ============================================================
// Public functionality
// ============================================================

/**
 * Connects to a XMPP realm.
 *
 * Connections can be reused between connections.
 * This means that an Connection may be connected, disconnected and then connected again.
 * Listeners of the Connection will be retained accross connections.
 *
 * If a connected Connection gets disconnected abruptly then it will try to reconnect again.
 * To stop the reconnection process, use disconnect(). Once stopped you can use connect() to manually connect to the realm.
 *
 * @access public
 */
Connection.prototype.connect = function(url, wsUrl) {
    if (url && wsUrl) {
        this._con_props = {
            httpbase: url,
            wait: this._con_wait,
            oDbg: this._con_debuger
        };
        this._con_ws_props = {
            httpbase: wsUrl,
            wait: this._con_wait,
            oDbg: this._con_debuger
        };
    }

    this._con_reconnect = true;
    this._connect();
};

/**
 * @access public
 */
Connection.prototype.reconnect = function(url, wsUrl) {
    if (this.isConnected()) {
        this.disconnect();
    }

    this._con_props = {
        httpbase: url,
        wait: this._con_wait,
        oDbg: this._con_debuger
    };
    this._con_ws_props = {
        httpbase: wsUrl,
        wait: this._con_wait,
        oDbg: this._con_debuger
    };

    this._con_reconnect = true;
    this._connect();
};

/**
 * @private
 */
Connection.prototype._connect = function() {
    this._con_id++;
    this._con = "WebSocket" in window ? new JSJaCWebSocketConnection(this._con_ws_props) : new JSJaCHttpBindingConnection(this._con_props);
    this._con.registerHandler('onconnect', this._proxy(this._handleConnected, this));
    this._con.registerHandler('ondisconnect', this._proxy(this._handleDisconnected, this));
    this._con.registerHandler('onerror', this._proxy(this._handleConnectionError, this));
    this._con.registerHandler('presence', this._proxy(this._handlePresence, this));
    this._con.registerHandler('message', this._proxy(this._handleMessage, this));
    this._con.registerHandler('iq', this._proxy(this._handleIQ, this));

    var params = {
        domain: this._realm,
        username: this._uid,
        pass: this._password,
        resource: this._resource,
        register: false
    };

    this._connecting = true;

    try {
        this._con.connect(params);
    } catch (e) {
        console.log(e);
    }
};

/**
 * Closes the connection to XMPP realm.
 *
 * @access public
 */
Connection.prototype.disconnect = function() {
    this._con_reconnect = false;
    this._disconnect();
};

/**
 * @private
 */
Connection.prototype._disconnect = function() {
    this._connected = false;

    try {
        this._con.disconnect();
    } catch(e) {
        this._con_errors.push(e);
    }
};

/**
 * @private
 */
Connection.prototype.send = function() {
    return this._con.send.apply(this._con, arguments);
};

/**
 * @private
 */
Connection.prototype.sendIQ = function() {
    return this._con.sendIQ.apply(this._con, arguments);
};

/**
 * Returns true if currently connected to the XMPP realm.
 *
 * @access public
 * @returns {boolean}
 */
Connection.prototype.isConnected = function() {
    return this._connected;
};

/**
 * Register a handler for specified event.
 * Following events are supported:
 *   onconnect - fires when successfully connected to XMPP realm (fired on reconnect also).
 *   ondisconnect - fires when disconnected from XMPP realm (fired on reconnect also).
 *   onerror - fires when error returns from XMPP realm.
 *   presence - fires when presence packet are received.
 *   message - fires when message packet are received.
 *   iq - fires when iq packet are received.
 *
 * @private
 * @param event {string}
 * @param callback {function}
 * @param scope {object}
 * @param priority {int}
 */
Connection.prototype.registerHandler = function(event, callback, scope, priority) {
    var handler = {
        callback: callback,
        scope: scope,
        priotiry: priority
    };
    if (typeof(this.handlers[event]) === "undefined") {
        this.handlers[event] = [handler];
    } else {
        this.handlers[event].push(handler);
        this.handlers[event].sort(this._priorityComparator);
    }
};

/**
 * Unregister a previously registered handler.
 *
 * @param event {string}
 * @param callback {function}
 */
Connection.prototype.unregisterHandler = function(event, callback) {
    var events = this.handlers[event];
    if (typeof(events) !== "undefined") {
        var filtered = [];
        for(var i=0; i < events.length; i++) {
            if (events[i]['callback'] != callback) {
                filtered.push(events[i]);
            }
        }
        this.handlers[event] = filtered;
    }
};

/**
 * Returns uid that are used to connect to XMPP realm.
 *
 * @returns {string}
 */
Connection.prototype.getExtension = function() {
    return this._uid;
};

/**
 * Returns realm that are used to connect to XMPP server.
 *
 * @returns {string}
 */
Connection.prototype.getRealm = function() {
    return this._realm;
};

/**
 * Returns a JID that are used to connect to XMPP realm.
 *
 * @returns {string}
 */
Connection.prototype.getJid = function() {
    return this._jid;
};

/**
 * Returns a full JID (with resource) that are used to connect to XMPP Server.
 *
 * @returns {string}
 */
Connection.prototype.getFullJid = function() {
    return this._jid_full;
};

/**
 * @private
 * @param event
 * @param args
 */
Connection.prototype._execute = function(event, args) {
    var handlers = this.handlers[event];
    if (typeof(handlers) !== "undefined") {
        for(var i=0; i < handlers.length; i++) {
            var handler = handlers[i];
            var handled = handler.callback.apply(handler.scope, args);
            if (handled) {
                break;
            }
        }
    }
};

// ============================================================
// JsJac callbacks
// ============================================================

/**
 * @private
 * @event Connection#connected
 */
Connection.prototype._handleConnected = function() {
    this._connecting = false;
    this._connected = true;
    this._fire("connected");

    // We should clear reconnection timers after good connection delay
    var id = this._con_id;

    setTimeout(() => {
        if (id == this._con_id) {
            this._recon_time = false;
            this._recon_timeout = false;
        }
    }, this._recon_timeout_skip * 1000);

    // -----
    if (!this._silent) {
        var presence = new JSJaCPresence();
        this._con.send(presence);
    }
};

/**
 * Connection error handler
 *
 * @private
 * @param error {Node}
 */
Connection.prototype._handleConnectionError = function(error) {
    // Verify whether problem is in resource name.
    if (error.getAttribute("code") == "503" && error.firstChild && error.firstChild.tagName == "remote-stream-error") {
        this._resource_postfix = Math.round(Math.random()*10000);
        this._resource = this._makeResource(this._uid, this._password, this._resource_prefix, this._resource_postfix);
        this._jid_full = this._jid +"/"+ this._resource;
    }

    if (this._connected) {
        this._con_errors.push(error);
        this._disconnect();
        this._handleDisconnected();
    }

    this._con_errors.push(error);
    this._connecting = false;
};

/**
 * Fires when user has been disconnected (fired by jsjac connection object).
 *
 * @private
 * @event Connection#connected
 */
Connection.prototype._handleDisconnected = function() {
    var error;
    if (this._con_errors.length > 0) {
        error = this._con_errors[0];
        if (error instanceof Node) {
            var tmp = document.createElement("div");
            tmp.appendChild(this._con_errors[0]);
            error = tmp.innerHTML;
        }
    }

    this._connected = false;
    this._connecting = false;
    this._fire("disconnected", error);
};

/**
 * @private
 */
Connection.prototype._handlePresence = function() {
    this._execute("presence", arguments);
};

/**
 * @private
 */
Connection.prototype._handleMessage = function() {
    this._execute("message", arguments);
};

/**
 * @private
 */
Connection.prototype._handleIQ = function() {
    this._execute("iq", arguments);
};

/**
 * @private
 */
Connection.prototype._handleIQCallback = function(callback, scope, args) {
    return {
        error_handler: function(iq) {
            var node = iq.getNode();
            var errors = node.getElementsByTagName("error");
            var reason = "unknown";

            if (errors.length > 0) {
                var error = errors[0];
                var type = error.firstChild;
                if (type) {
                    reason = type.tagName;
                }
            }

            // TODO: Property handle error
            console.error("iq callback error", reason);
        },
        result_handler: function(iq) {
            args.unshift(iq);
            callback.apply(scope, args);
        }
    }
};

// ============================================================
// Private functionality
// ============================================================

/**
 * @private
 */
Connection.prototype._verify = function() {
    var time = Math.round(new Date().getTime() / 1000);

    if (this._con_reconnect) {
        if (this._con_errors.length > 0) {
            this._con_errors = [];

            // Define reconnection timeout
            this._recon_time = this._verify_timeout;
            this._recon_timeout = this._random(this._recon_timeout_min, this._recon_timeout_max);
        } else if (this._connected == false && this._connecting == false) {
            if (this._recon_time) {
                // We should connect to realm when timeout has come
                if (this._recon_time >= this._recon_timeout) {
                    this._connect();
                } else {
                    this._recon_time += this._verify_timeout;
                }
            } else {
                this._connect();
            }
        } else if (this._connected == true && this._con instanceof JSJaCHttpBindingConnection) {
            this._con_secs += this._verify_timeout;

            if (this._con) {
                // Solution to detect if user hasn't internet connection.
                if (this._con_rid != this._con._rid) {
                    this._con_rid = this._con._rid;
                    this._con_secs = 0;
                } else if (this._con_secs > this._recon_inactivity) {
                    if (this._connected && !this._connecting) {
                        this._con_errors.push("Found this connection is not alive!");
                        this._disconnect();
                    }
                }
            }

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
    }

    this._verify_time = time;
    setTimeout(this._proxy(this._verify, this), this._verify_timeout * 1000);
};

/**
 * Generates a resource for connection.
 * Resource generation is based on username, password, browser name and protocol.
 *
 * @private
 * @param username
 * @param password
 * @param prefix
 * @param postfix
 */
Connection.prototype._makeResource = function(username, password, prefix, postfix) {
    var str = username +"-"+ password +"-"+ window.location.protocol +"-"+ navigator.userAgent;
    var hash1 = (5381<<16) + 5381;
    var hash2 = hash1;
    var hashPos = 0;

    while(hashPos < str.length) {
        hash1 = ((hash1 << 5) + hash1 + (hash1 >> 27)) ^ str.charCodeAt(hashPos);
        if( hashPos == str.length - 1) {
            break;
        }
        hash2 = ((hash2 << 5) + hash2 + (hash2 >> 27)) ^ str.charCodeAt(hashPos + 1);
        hashPos += 2;
    }

    hash1 = String(hash1);
    hash2 = String(hash2 * 1566083941);

    var resource = prefix +"-"+ username + "-" + hash1.substr(hash1.length - 4, 4) + "-" + hash2.substr(hash1.length - 4, 4);

    if (postfix) {
        resource = resource +"-"+ postfix;
    }

    return resource;
};

/**
 * Generates an unique id for current browser (used in resource)
 *
 * @private
 * @param username
 * @param password
 * @param prefix
 */
Connection.prototype._makeUniqueId = function(username, password, prefix) {
    var str = username + password + window.location.protocol + navigator.userAgent + Math.random();
    var hash1 = (5381<<16) + 5381;
    var hash2 = hash1;
    var hashPos = 0;

    while(hashPos < str.length) {
        hash1 = ((hash1 << 5) + hash1 + (hash1 >> 27)) ^ str.charCodeAt(hashPos);
        if( hashPos == str.length - 1) {
            break;
        }
        hash2 = ((hash2 << 5) + hash2 + (hash2 >> 27)) ^ str.charCodeAt(hashPos + 1);
        hashPos += 2;
    }

    hash1 = String(hash1);
    hash2 = String(hash2 * 1566083941);

    return prefix +"_"+ username + "_" + hash1.substr(hash1.length - 4, 4) + "_" + hash2.substr(hash1.length - 4, 4);
};

/**
 * Generates a random number in specified range.
 *
 * @private
 * @param from int
 * @param to int
 */
Connection.prototype._random = function(from, to) {
   return Math.floor(Math.random() * (to - from + 1) + from);
};

/**
 * Wraps callback to be sure that function will be executed in proper scope
 *
 * @private
 * @param callback function
 * @param scope object
 */
Connection.prototype._proxy = function(callback, scope) {
   return function() {
       callback.apply(scope, arguments);
   };
};

/**
 * TODO: Description
 *
 * @private
 */
Connection.prototype._priorityComparator = function(a, b) {
    if (a.priotiry < b.priotiry)
        return -1;
    if (a.priotiry > b.priotiry)
        return 1;
    return 0;
};

export default Connection;