import Observable from './Observable';
import {JSJaCIQ} from '../include/jsjac';

var NS_CC = "urn:carusto:cc";
var NS_CALL = "urn:carusto:cc:call";

/**
 * @param connection
 * @constructor
 */
function Cc(connection) {
    this._queues = [];
    this._subscribed = false;

    this._con = connection;
    this._con.registerHandler("message", this._handleMessage, this, 10);
    this._con.addListener("disconnected", this._onDisconnected, this);

    // Initialize supper
    Observable.call(this);
};

Cc.prototype = Object.create(Observable.prototype);

// ============================================================
// Public functions
// ============================================================

/**
 * Initiates a call to a specified number using all available registrations.
 */
Cc.prototype.subscribe = function(callback, scope) {
    var packet = this._createSubscribePacket();
    var handler = this._proxyIqSubscription(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Checks whether subscription are active.
 */
Cc.prototype.isSubscribed = function() {
    return this._subscribed;
}

/**
 * Gets a specified queue based on id
 */
Cc.prototype.getQueue = function(id) {
    var queue = null;
    for (var i=0; i < this._queues.length; i++) {
        if (this._queues[i].getId() == id) {
            queue = this._queues[i];
        }
    }

    return queue;
}

/**
 * Gets a list of available queues.
 */
Cc.prototype.getQueues = function() {
    return this._queues;
}

// ============================================================
// Plugin callbacks
// ============================================================

/**
 * @private
 */
Cc.prototype._onDisconnected = function() {
    this._subscribed = false;

    for (var i = this._queues.length; i--;) {
        this._fire("queue_deleted", this._queues[i]);
    }

    this._queues = [];
}

/**
 * @private
 */
Cc.prototype._handleMessage = function(message) {
    if (this._handleQueueEventMessage(message)) {
        return true;
    } else if (this._handleQueueCallEventMessage(message)) {
        return true;
    }
}

/**
 * @private
 */
Cc.prototype._handleQueueEventMessage = function(message) {
    var event = message.getChild("event", NS_CC);
    if (event !== null) {
        var type = event.getAttribute("type");
        switch (type) {
            case "create":
                this._handleQueuesAdded(this._parseQueueItems(event));
                break;
            case "update":
                this._handleQueuesUpdated(this._parseQueueItems(event));
                break;
            case "delete":
                this._handleQueuesRemoved(this._parseQueueItems(event));
                break
        }

        return true;
    }
}

/**
 * @private
 */
Cc.prototype._handleQueueCallEventMessage = function(message) {
    var event = message.getChild("event", NS_CALL);
    if (event !== null) {
        var type = event.getAttribute("type");
        var id = event.getAttribute("queue");

        switch (type) {
            case "create":
                this._handleQueuesCallAdded(id, this._parseQueueCallItems(event));
                break;
            case "update":
                this._handleQueuesCallUpdated(id, this._parseQueueCallItems(event));
                break;
            case "delete":
                this._handleQueuesCallRemoved(id, this._parseQueueCallItems(event));
                break
        }

        return true;
    }
}

/**
 * @private
 */
Cc.prototype._handleQueuesAdded = function(items) {
    for (var i=0; i < items.length; i++) {
        var queue = Queue.fromObject(items[i]);
        var duplicate = false;

        for (var c=0; c < this._queues.length; c++) {
            if (this._queues[c].getId() == queue.getId()) {
                duplicate = true;
                break;
            }
        }

        if (!duplicate) {
            this._queues.push(queue);
            this._fire("queue_added", queue);
        }
    }
}

/**
 * @private
 */
Cc.prototype._handleQueuesUpdated = function(items) {
    for (var i=0; i < items.length; i++) {
        var id = items[i].id;

        for (var c=0; c < this._queues.length; c++) {
            var queue = this._queues[c];

            if (queue.getId() === id) {
                queue.updateFromObject(items[i]);
                this._fire("queue_updated", queue);
            }
        }
    }
}

/**
 * @private
 */
Cc.prototype._handleQueuesRemoved = function(items) {
    for (var i=0; i < items.length; i++) {
        var id = items[i].id;
        var filtered = [];

        for (var c=0; c < this._queues.length; c++) {
            var queue = this._queues[c];
            if (queue.getId() !== id) {
                filtered.push(queue);
            } else {
                this._fire("queue_deleted", queue);
            }
        }

        this._queues = filtered;
    }
}

/**
 * @private
 */
Cc.prototype._handleQueuesCallAdded = function(id, items) {
    var queue = this.getQueue(id);
    if (queue != null) {
        for (var i=0; i < items.length; i++) {
            var call = QueueCall.fromObject(items[i]);
            queue.addCall(call);

            this._fire("queue_call_added", queue, call);
        }
    }
}

/**
 * @private
 */
Cc.prototype._handleQueuesCallUpdated = function(id, items) {
    var queue = this.getQueue(id);
    if (queue != null) {
        for (var i=0; i < items.length; i++) {
            var call = queue.getCall(items[i]['id']);
            if (call != null) {
                call.updateFromObject(items[i]);
                this._fire("queue_call_updated", queue, call);
            }
        }
    }
}

/**
 * @private
 */
Cc.prototype._handleQueuesCallRemoved = function(id, items) {
    var queue = this.getQueue(id);
    if (queue != null) {
        for (var i=0; i < items.length; i++) {
            var call = queue.getCall(items[i]['id']);
            if (call != null) {
                queue.removeCall(call);
                this._fire("queue_call_deleted", queue, call);
            }
        }
    }
}

/**
 *
 * @param items
 * @returns {*}
 * @private
 */
Cc.prototype._handleCallsState = function(items) {
    return this._handleCallsAdded(items);
}

// ============================================================
// Private functions
// ============================================================

/**
 * Generates a call originate command packet
 * @private
 */
Cc.prototype._createSubscribePacket = function(to) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_CC);

    return packet;
}

/**
 * @private
 */
Cc.prototype._parseQueueItems = function(event) {
    var items = event.getElementsByTagName("queue");
    var queues = [];

    for (var i=0; i < items.length; i++) {
        queues.push(this._parseQueueItem(items.item(i)));
    }

    return queues;
};


/**
 * @private
 */
Cc.prototype._parseQueueItem = function(element) {
    // Parse calls
    var calls = [];
    var callEls = element.getElementsByTagName("call");
    for (let i=0; i < callEls.length; i++) {
        let el = callEls.item(i);
        let call = QueueCall.fromObject(this._parseQueueCallItem(el));

        calls.push(call);
    }

    // Parse members
    var members = [];
    var memberEls = element.getElementsByTagName("member");
    for (let i=0; i < memberEls.length; i++) {
        let el = memberEls.item(i);
        let jid = el.getAttribute("jid");

        members.push(jid);
    }

    return {
        id: element.getAttribute('id'),
        name: element.getAttribute('name'),
        members: members,
        calls: calls
    }
};

/**
 * @private
 */
Cc.prototype._parseQueueCallItems = function(event) {
    var items = event.getElementsByTagName("call");
    var calls = [];

    for (var i=0; i < items.length; i++) {
        calls.push(this._parseQueueCallItem(items.item(i)));
    }

    return calls;
};

/**
 * @private
 */
Cc.prototype._parseQueueCallItem = function(element) {
    var flows = [];
    var flowEls = element.getElementsByTagName("flow");
    for (var i=0; i < flowEls.length; i++) {
        var el = flowEls.item(i);
        var id = el.getAttribute("id");
        var type = el.getAttribute("type");
        var name = el.getAttribute("name");

        flows.push(new QueueCallFlow(id, type, name));
    }

    return {
        id: element.getAttribute('id'),
        name: element.getAttribute('name'),
        number: element.getAttribute('number'),
        waitTime: element.getAttribute('wait_time'),
        talkTime: element.getAttribute('talk_time'),
        flows: flows
    }
};

/**
 * @private
 */
Cc.prototype._proxyIqSubscription = function(callback, scope) {
    var me = this;
    return {
        result_handler: function(iq) {
            var items = me._parseQueueItems(iq.getNode());

            me._subscribed = true;
            me._queues = [];

            for (var i=0; i < items.length; i++) {
                me._queues.push(Queue.fromObject(items[i]));
            }

            callback.call(scope, me._queues);
        }
    }
};

// ============================================================
// Shared classes
// ============================================================


/**
 * @constructor
 */
function Queue(id, name, members, calls) {
    this._id = id;
    this._name = name;
    this._members = members;
    this._calls = calls;
}

/**
 * Gets an unique id of queue
 * @public
 */
Queue.prototype.getId = function() {
    return this._id;
};

/**
 * Get a name of queue
 * @public
 */
Queue.prototype.getName = function() {
    return this._name;
};

/**
 * Gets a list of members that accept calls in that queue.
 * @public
 */
Queue.prototype.getMembers = function() {
    return this._members;
};

/**
 * Gets a list of active calls on that queue.
 * @public
 */
Queue.prototype.getCalls = function() {
    return this._calls;
};

/**
 * @private
 */
Queue.prototype.getCall = function(id) {
    for (var i=0; i < this._calls.length; i++) {
        var c = this._calls[i];
        if (c.getId() == id) {
            return c;
        }
    }

    return null;
};

/**
 * @private
 */
Queue.prototype.addCall = function(call) {
    this._calls.push(call);
};

/**
 * @private
 */
Queue.prototype.removeCall = function(call) {
    var filtered = [];

    for (var i=0; i < this._calls.length; i++) {
        var c = this._calls[i];
        if (c.getId() !== call.getId()) {
            filtered.push(c);
        }
    }

    this._calls = filtered;
};

/**
 * @private
 */
Queue.fromObject = function(params) {
    return new Queue(params.id, params.name, params.members, params.calls);
};

/**
 * @private
 */
Queue.prototype.updateFromObject = function(o) {
    this._id = o.id;
    this._name = o.name;
    this._members = o.members;
    this._calls = o.calls;
};

/**
 * @public
 * @constructor
 */
function QueueCall(id, name, number, waitTime, talkTime, flows) {
    this._id = id;
    this._name = name;
    this._number = number;
    this._waitTime = parseInt(waitTime);
    this._waitTimePoint = Math.round(new Date().getTime() / 1000);
    this._talkTime = parseInt(talkTime);
    this._talkTimePoint = Math.round(new Date().getTime() / 1000);
    this._flows = flows;
}

/**
 * @private
 */
QueueCall.fromObject = function(o) {
    return new QueueCall(o.id, o.name, o.number, o.waitTime, o.talkTime, o.flows);
};

/**
 * @public
 */
QueueCall.prototype.getId = function() {
    return this._id;
};

/**
 * @public
 */
QueueCall.prototype.getName = function() {
    return this._name;
};

/**
 * @public
 */
QueueCall.prototype.getNumber = function() {
    return this._number;
};

/**
 * @public
 */
QueueCall.prototype.getWaitTime = function() {
    if (this._waitTime == -1) {
        return -1;
    }

    if (this._talkTime == -1) {
        var time = Math.round(new Date().getTime() / 1000),
            offset = time - this._waitTimePoint;

        return this._waitTime + offset;
    }

    return this._waitTime;
};

/**
 * Returns a wait time in "MM:SS" format.
 * @public
 * @returns {string}
 */
QueueCall.prototype.getFormattedWaitTime = function() {
    var seconds = this.getWaitTime();
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
 * @public
 */
QueueCall.prototype.getTalkTime = function() {
    if (this._talkTime == -1) {
        return -1;
    }

    var time = Math.round(new Date().getTime() / 1000);
    var offset = time - this._talkTimePoint;
    return this._talkTime + offset;
};

/**
 * Returns a talk time in "MM:SS" format ("-" is returned when talk time is not available).
 * @public
 * @returns {string}
 */
QueueCall.prototype.getFormattedTalkTime = function() {
    var seconds = this.getTalkTime();
    if (seconds < 0) {
        return "-";
    } else if (isNaN(seconds)) {
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
 * @public
 */
QueueCall.prototype.getFlows = function() {
    return this._flows;
};

/**
 * @private
 */
QueueCall.prototype.updateFromObject = function(o) {
    this._id = o.id;
    this._name = o.name;
    this._number = o.number;
    this._waitTime = parseInt(o.waitTime);
    this._waitTimePoint = Math.round(new Date().getTime() / 1000);
    this._talkTime = parseInt(o.talkTime);
    this._talkTimePoint = Math.round(new Date().getTime() / 1000);
    this._flows = o.flows;
};

/**
 * @public
 * @constructor
 */
function QueueCallFlow(id, type, name) {
    this._id = id;
    this._type = type;
    this._name = name;
}

QueueCallFlow.prototype.getId = function() {
    return this._id;
};

QueueCallFlow.prototype.getType = function() {
    return this._type;
};

QueueCallFlow.prototype.getName = function() {
    return this._name;
};

export {
    Cc,
    Queue,
    QueueCall,
    QueueCallFlow
};