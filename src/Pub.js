'use strict';

import {JSJaCIQ} from '../include/jsjac';
import {proxyIq, nodeValue} from './Utils';
import Observable from './Observable';

var NS_PUB = "urn:carusto:pub";
var NS_PUB_SUBSCRIBE = "urn:carusto:pub:subscribe";
var NS_PUB_PULL = "urn:carusto:pub:pull";
var NS_PUB_EXECUTE = "urn:carusto:pub:execute";

/**
 * @param connection
 * @constructor
 */
function Pub(connection) {
    this._con = connection;
    this._con.registerHandler("message", this._handleMessage, this, 100);
    this._con.registerHandler("message", this._handleMessagePull, this, 100);
    this._con.addListener("connected", this._onConnected, this);
    this._con.addListener("disconnected", this._onDisconnected, this);

    this._nodes = {};
    this._subscriptions = {};

    // Initialize supper
    Observable.call(this);
};

Pub.prototype = Object.create(Observable.prototype);

// ============================================================
// Public
// ============================================================


/**
 * @pubic
 * @param {String} node
 * @param {Function} callback
 * @param {Object} scope
 */
Pub.prototype.add = function (node, callback, scope) {
    if (this._subscriptions.hasOwnProperty(node)) {
        this._subscriptions[node].push({callback: callback, scope: scope});
    } else {
        this._subscriptions[node] = [{callback: callback, scope: scope}];

        if (this._con.isConnected()) {
            this.subscribeSilent(node);
        }
    }
};

/**
 * @pubic
 * @param {String} node
 * @param {Function} callback
 */
Pub.prototype.remove = function (node, callback) {
    if (this._subscriptions.hasOwnProperty(node)) {
        var handlers = this._subscriptions[node];
        var index = -1;

        for (var i=0; i < handlers.length; i++) {
            if (handlers[i]['callback'] === callback) {
                index = i;
                break;
            }
        }

        if (index > -1) {
            handlers.splice(index, 1);
        }

        if (handlers.length == 0 && this._con.isConnected()) {
            this.unsubscribeSilent(node);
            delete this._subscriptions[node];
        }
    }
};

/**
 * @public
 */
Pub.prototype.subscribe = function(node, callback, scope) {
    if (!callback) {
        return this.subscribeSilent(node);
    }

    var packet = this._createSubscribePacket(node, true);
    var handler = proxyIq(function(response) {
        if (response.isSuccess()) {
            var node = response.getIq().getNode();
            var responses = node.getElementsByTagName("response");
            var result = [];

            if (responses.length > 0) {
                result = this._handleStore(this._parseNodes(responses.item(0)), true);
            }

            response._json = result;
        }

        callback.call(scope, response);
    }, this);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.subscribeSilent = function(node) {
    var packet = this._createSubscribePacket(node, true, true);
    var handler = proxyIq(function() {}, this);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.subscriptions = function(callback, scope) {
    var packet = this._createSubscriptionsPacket();
    var handler = proxyIq(callback, scope);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.unsubscribe = function(node, callback, scope) {
    var packet = this._createSubscribePacket(node, false);
    var handler = proxyIq(callback, scope);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.unsubscribeSilent = function(node) {
    var packet = this._createSubscribePacket(node, false);
    var handler = proxyIq(function() {}, this);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.store = function(node, id, data, callback, scope) {
    var packet = this._createStorePacket(node, id, data);
    var handler = proxyIq(callback, scope);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.clear = function(node, id, callback, scope) {
    var packet = this._createClearPacket(node, id);
    var handler = proxyIq(callback, scope);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.execute = function(id, data, callback, scope) {
    var packet = this._createExecutePacket(id, data);
    var handler = proxyIq(callback, scope);

    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Pub.prototype.getNodes = function() {
    var nodes = [];

    for (var name in this._nodes) {
        if (this._nodes.hasOwnProperty(name)) {
            nodes.push(this._nodes[name]);
        }
    }

    return nodes;
};

/**
 * @public
 */
Pub.prototype.getNode = function(name) {
    if (this._nodes.hasOwnProperty(name)) {
        return this._nodes[name];
    }

    return null;
};

// ============================================================
// Plugin callbacks
// ============================================================

/**
 * @private
 */
Pub.prototype._onConnected = function() {
    // Subscriptions
    for (var node in this._subscriptions) {
        if (this._subscriptions.hasOwnProperty(node)) {
            this.subscribeSilent(node);
        }
    }
};

/**
 * @private
 */
Pub.prototype._onDisconnected = function() {
    for (var name in this._nodes) {
        if (this._nodes.hasOwnProperty(name)) {
            var node = this._nodes[name];
            var items = node.getItems();

            for (var f=0; f < items.length; f++) {
                this._fire("clear", node, items[f]);
            }
        }
    }

    this._nodes = {};
};

/**
 * @private
 */
Pub.prototype._handleMessage = function(message) {
    var event = message.getChild("event", NS_PUB);
    if (event !== null) {
        var type = event.getAttribute("type");
        var body = nodeValue(event);
        var data = JSON.parse(body);
        var msg = new PubSubEvent(type, data);

        // -----
        this._fire("event", msg);

        // -----
        this._fire(type, data);

        return true;
    }
};

/**
 * @private
 */
Pub.prototype._handleMessagePull = function(message) {
    var event = message.getChild("event", NS_PUB_PULL);
    if (event !== null) {
        var type = event.getAttribute("type");
        switch (type) {
            case "store":
                this._handleStore(this._parseNodes(event));
                break;
            case "clear":
                this._handleClear(this._parseNodes(event));
                break;
            case "broadcast":
                this._handleBroadcast(this._parseNodes(event));
                break;
        }

        return true;
    }
};

/**
 * @private
 */
Pub.prototype._handleStore = function(nodes, silent) {
    var result = [];

    for (var i=0; i < nodes.length; i++) {
        var node = nodes[i];
        var name = node.getName();
        var prev = this._nodes.hasOwnProperty(name) ? this._nodes[name].getItems() : [];
        var newer = node.getItems();
        var items = [];
        var stores = [];

        for (var c=0; c < prev.length; c++) {
            var index = -1;

            for (var n=0; n < newer.length; n++) {
                if (prev[c].getId() == newer[n].getId()) {
                    index = n;
                    break;
                }
            }

            if (index >= 0) {
                items.push(newer[index]);
                stores.push(newer[index]);
                newer.splice(index, 1);
            } else {
                items.push(prev[c]);
            }
        }

        for (var r=0; r < newer.length; r++) {
            items.push(newer[r]);
            stores.push(newer[r]);
        }

        node._items = items;
        this._nodes[name] = node;
        result.push(node);

        if (!silent) {
            for (var f=0; f < stores.length; f++) {
                this._fire("store", node, stores[f]);
            }
        }
    }

    return result;
};

/**
 * @private
 */
Pub.prototype._handleClear = function(nodes) {
    for (var i=0; i < nodes.length; i++) {
        var node = nodes[i];
        var name = node.getName();
        var items = this._nodes.hasOwnProperty(name) ? this._nodes[name].getItems() : [];
        var clear = node.getItems();

        for (var c=0; c < items.length; c++) {
            var skip = false;

            for (var n=0; n < clear.length; n++) {
                if (items[c].getId() == clear[n].getId()) {
                    skip = true;
                    break;
                }
            }

            if (skip) {
                items.splice(c, 1);
            }
        }

        node._items = items;
        this._nodes[name] = node;

        for (var f=0; f < clear.length; f++) {
            this._fire("clear", node, clear[f]);
        }
    }
};

/**
 * @private
 */
Pub.prototype._handleBroadcast = function(nodes) {
    for (var i=0; i < nodes.length; i++) {
        var node = nodes[i];
        var items = node.getItems();

        for (var f=0; f < items.length; f++) {
            this._fire("broadcast", node, items[f]);

            if (this._subscriptions.hasOwnProperty(node.getName())) {
                var handlers = this._subscriptions[node.getName()];

                for (var s=0; s < handlers.length; s++) {
                    var handler = handlers[s];
                    var callback = handler['callback'];
                    var scope = handler['scope'];

                    try {
                        if (callback && scope) {
                            callback.call(scope, items[f]);
                        } else if (callback) {
                            callback(items[f]);
                        }
                    } catch (e) {
                        setTimeout(function () {
                            throw e;
                        }, 10)
                    }
                }
            }
        }
    }
};

// ============================================================
// Private functions
// ============================================================

/**
 * @private
 */
Pub.prototype._createSubscribePacket = function(name, subscribe, silent) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_PUB_SUBSCRIBE);
    var queryNode = packet.getDoc().createElement('node');
    queryNode.setAttribute("name", name);
    query.appendChild(queryNode);
    query.setAttribute("action", subscribe ? "subscribe" : "unsubscribe");

    if (silent) {
        query.setAttribute("silent", "yes");
    }

    return packet;
};

/**
 * @private
 */
Pub.prototype._createSubscriptionsPacket = function() {
    var packet = new JSJaCIQ();
    packet.setType('get');
    packet.setQuery(NS_PUB_SUBSCRIBE);

    return packet;
};

/**
 * @private
 */
Pub.prototype._createStorePacket = function(node, id, data) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_PUB);
    var queryNode = packet.getDoc().createElement('item');
    queryNode.setAttribute("node", node);
    queryNode.setAttribute("id", id);
    queryNode.appendChild(packet.getDoc().createTextNode(data));
    query.appendChild(queryNode);
    query.setAttribute("action", "store");

    return packet;
};

/**
 * @private
 */
Pub.prototype._createClearPacket = function(node, id) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_PUB);
    var queryNode = packet.getDoc().createElement('item');
    queryNode.setAttribute("node", node);
    queryNode.setAttribute("id", id);
    query.appendChild(queryNode);
    query.setAttribute("action", "clear");

    return packet;
};

/**
 * @private
 */
Pub.prototype._createExecutePacket = function(id, data) {
    var packet = new JSJaCIQ();
    packet.setType('get');
    var query = packet.setQuery(NS_PUB_EXECUTE);
    query.setAttribute("id", id);

    if (data) {
        query.appendChild(packet.getDoc().createTextNode(data));
    }

    return packet;
};

/**
 * @returns {Array}
 * @private
 */
Pub.prototype._parseNodes = function(el) {
    var items = el.getElementsByTagName("node");
    var calls = [];

    for (var i=0; i < items.length; i++) {
        calls.push(this._parseNode(items.item(i)));
    }

    return calls;
};

/**
 * @returns {object}
 * @private
 */
Pub.prototype._parseNode = function(element) {
    var items = [];
    var els = element.getElementsByTagName("item");

    for (var i=0; i < els.length; i++) {
        var el = els.item(i);
        var id = el.getAttribute("id");
        var data = nodeValue(el);
        var stamp = parseInt(el.getAttribute("stamp"));

        items.push(new PubSubItem(id, data, stamp));
    }

    var name = element.getAttribute('name');

    return new PubSubNode(name, items);
};

// ============================================================
// Shared classes
// ============================================================

/**
 * @constructor
 */
function PubSubEvent(type, data) {
    this._type = type;
    this._data = data;
}

/**
 * @public
 */
PubSubEvent.prototype.getType = function() {
    return this._type;
};

/**
 * @public
 */
PubSubEvent.prototype.getData = function() {
    return this._data;
};

/**
 * @constructor
 */
function PubSubNode(name, items) {
    this._name = name;
    this._items = items;
}

/**
 * @public
 */
PubSubNode.prototype.getName = function() {
    return this._name;
};

/**
 * @public
 */
PubSubNode.prototype.getItems = function() {
    return this._items;
};

/**
 * @constructor
 */
function PubSubItem(id, data, stamp) {
    this._id = id;
    this._data = data;
    this._stamp = stamp;
    this._date = new Date();
}

/**
 * @public
 */
PubSubItem.prototype.getId = function() {
    return this._id;
};

/**
 * @public
 */
PubSubItem.prototype.getData = function() {
    return this._data;
};

/**
 * @public
 */
PubSubItem.prototype.getStamp = function() {
    return this._stamp;
};

/**
 * @public
 */
PubSubItem.prototype.getStampOffset = function() {
    var prev = Math.floor(this._date.getTime() / 1000);
    var now = Math.floor(Date.now() / 1000);

    return this._stamp + (now - prev);
};

/**
 * @public
 */
PubSubItem.prototype.getJson = function() {
    if (!this._json) {
        this._json = JSON.parse(this._data);
    }

    return this._json;
};

export {
    Pub,
    PubSubEvent,
    PubSubNode,
    PubSubItem
};
