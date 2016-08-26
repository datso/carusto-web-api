import Observable from './Observable';
import {JSJaCIQ} from '../include/jsjac';

var NS_AC = "urn:carusto:ac";
var NS_AC_RESOURCE = "urn:carusto:ac:resource";
var NS_AC_REG = "urn:carusto:ac:reg";
var NS_AC_SPY = "urn:carusto:ac:spy";

/**
 * @param connection
 * @constructor
 */
function Ac(connection) {
    // Interop
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.msRTCPeerConnection;
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.msRTCSessionDescription;
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.msRTCIceCandidate;

    this._calls = [];
    this._registrations = [];

    this._con = connection;
    this._con.registerHandler("message", this._handleMessage, this, 10);
    this._con.registerHandler("iq", this._handleIQ, this, 10);
    this._con.addListener("connected", this._onConnected, this);
    this._con.addListener("disconnected", this._onDisconnected, this);

    // Initialize supper
    Observable.call(this);
};

Ac.prototype = Object.create(Observable.prototype);

// ============================================================
// Public events
// ============================================================

/**
 * Indicates that SIP registrations are changed
 *
 * @event registrations_changed
 * @type {object}
 * @property {Array} A List of SIP registrations
 */

/**
 * Indicates that new call is added
 *
 * @event call_added
 * @property {Call} call A call that was added
 */

/**
 * Indicates that call was updated
 *
 * @event call_updated
 * @property {Call} call A call that was updated
 */

/**
 * Indicates that call was terminated
 *
 * @event call_terminated
 * @property {Call} call A call that was terminated
 */

// ============================================================
// Public functions
// ============================================================

/**
 * Initiates a call to a specified number using all available registrations.
 */
Ac.prototype.originate = function(to, callback, scope) {
    var packet = this._createOriginatePacket(to);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Initiates a call to specified number using all available registrations.
 * User who initiated a call, should respond to the call, and only then PBX will start call to destination.
 */
Ac.prototype.originateUsingRegistration = function(to, registration, callback, scope) {
    var packet = this._createOriginateUsingRegistrationPacket(to, registration);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Initiates a call to specified number using a mobile number.
 */
Ac.prototype.originateUsingMobility = function(to, number, callback, scope) {
    var packet = this._createOriginateUsingMobilityPacket(to, number);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Answer a specified incoming call at a specified device.
 */
Ac.prototype.answer = function(call, channel, callback, scope) {
    var packet = this._createAnswerCallPacket(call, channel);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Ends a specified call.
 */
Ac.prototype.hangup = function(call, callback, scope) {
    var packet = this._createHangUpCallPacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Ends a specified call.
 */
Ac.prototype.decline = function(call, callback, scope) {
    var packet = this._createDeclineCallPacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Put a specified call on HOLD.
 */
Ac.prototype.hold = function(call, callback, scope) {
    var packet = this._createHoldPacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Resumes a specified call from HOLD.
 */
Ac.prototype.resume = function(call, callback, scope) {
    var packet = this._createResumePacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Resumes a specified call from HOLD.
 */
Ac.prototype.mute = function(call, callback, scope) {
    var packet = this._createMutePacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Resumes a specified call from HOLD.
 */
Ac.prototype.unmute = function(call, callback, scope) {
    var packet = this._createUnmutePacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Performs a blind transfer or call forwarding to a specified number.
 */
Ac.prototype.forward = function(call, to, callback, scope) {
    var packet = this._createForwardPacket(call, to);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Performs an attendant transfer with a specified calls.
 */
Ac.prototype.bridge = function(call1, call2, callback, scope) {
    var packet = this._createBridgePacket(call1, call2);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Execute DTMF on a specified call.
 */
Ac.prototype.dtmf = function(call, key, callback, scope) {
    var packet = this._createDTMFPacket(call, key);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Start recording for a specified call.
 */
Ac.prototype.startRecord = function(call, callback, scope) {
    var packet = this._createStartRecordPacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * End record of a specified call.
 */
Ac.prototype.stopRecord = function(call, callback, scope) {
    var packet = this._createStopRecordPacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Returns a list of available calls.
 *
 * @access public
 * @returns {Array}
 */
Ac.prototype.getAvailableCalls = function() {
    return this._calls.slice(0);
}

/**
 * Returns a list of available registrations.
 *
 * @access public
 * @returns {Array}
 */
Ac.prototype.getAvailableRegistrations = function() {
    return this._registrations.slice(0);
}

/**
 * Returns a list of available contact calls
 */
Ac.prototype.spy = function(contact, callback, scope) {
    var packet = this._createSpyPacket(contact.getJid());
    var handler = this._proxyIqSpy(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Pickups a specified call
 */
Ac.prototype.spyPickup = function(call, registration, callback, scope) {
    var packet = this._createSpyPickupPacket(call, registration);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Execute intrusion to a specified call
 */
Ac.prototype.spyIntrusion = function(call, registration, callback, scope) {
    var packet = this._createSpyIntrusionPacket(call, registration);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Execute intrusion to a specified call
 */
Ac.prototype.spyDecline = function(call, callback, scope) {
    var packet = this._createSpyDeclinePacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Execute intrusion to a specified call
 */
Ac.prototype.spyTerminate = function(call, callback, scope) {
    var packet = this._createSpyTerminatePacket(call);
    var handler = this._proxyIqCallback(callback, scope);
    this._con.sendIQ(packet, handler);
}

// ============================================================
// Plugin callbacks
// ============================================================

/**
 * @private
 */
Ac.prototype._onConnected = function() {

};

/**
 * @private
 * @fires WTAPI.Ac#devices_changed
 * @fires WTAPI.Ac#call_terminated
 */
Ac.prototype._onDisconnected = function() {
    // Clean calls
    for (var c=0; c < this._calls.length; c++) {
        var call = this._calls[c];
        call._state = "down";

        // Clean resources
        var resources = call.getAllResources()
        for (var r=0; r < resources.length; r++) {
            var resource = resources[r];
            try {
                resource.getHandler().onDestroy();
            } catch (e) {
                console.error("An error occurs during resource destroy", e);
            }

            this._fire("call_resource_removed", call, resource);
        }

        this._fire("call_terminated", call);
    }
    this._calls = [];
    this._registrations = [];
};

/**
 * @private
 */
Ac.prototype._handleMessage = function(message) {
    if (this._handleCallsStateMessage(message)) {
        return true;
    } else if (this._handleRegistrationsStateMessage(message)) {
        return true;
    } else if (this._handleResourcesMessage(message)) {
        return true;
    }
};

/**
 * @private
 */
Ac.prototype._handleIQ = function(iq) {
    if (iq.getQueryXMLNS() == NS_AC_RESOURCE) {
        var query = iq.getQuery();
        var id = query.getAttribute("id");
        var meet = query.getAttribute("meet");
        var call = null;

        for (var c=0; c < this._calls.length; c++) {
            if (this._calls[c].getMeet() == meet) {
                call = this._calls[c];
                break;
            }
        }

        if (call != null) {
            var resource = call.getAnyResourceEmptyNull(id);
            if (resource != null) {
                var handler = resource.getHandler();
                handler.onIq(iq, query);

                return true;
            }
        }

        if (iq.getType() == "result" || iq.getType() == "error") {
            return true;
        }

        // Resource not found error
        this._handleIqError(iq, {
            code: "400",
            type: "modify",
            cond: "not-found"
        });

        return true;
    }

    return false;
};

/**
 * Send a response error for IQ
 *
 * @private
 */
Ac.prototype._handleIqError = function(iq, error) {
    var response = iq.errorReply(error);
    this._con.send(response);
};

/**
 *
 * @private
 * @param message
 */
Ac.prototype._handleCallsStateMessage = function(message) {
    var event = message.getChild("event", NS_AC);
    if (event !== null) {
        var type = event.getAttribute("type");
        switch (type) {
            case "create":
                this._handleCallsAdded(this._parseCallItems(event));
                break;
            case "update":
                this._handleCallsUpdated(this._parseCallItems(event));
                break;
            case "delete":
                this._handleCallsRemoved(this._parseCallItems(event));
                break;
            case "state":
                this._handleCallsState(this._parseCallItems(event));
                break;
        }

        return true;
    }
}

/**
 * @private
 * @param message
 */
Ac.prototype._handleRegistrationsStateMessage = function(message) {
    var event = message.getChild("event", NS_AC_REG);
    if (event !== null) {
        var type = event.getAttribute("type");
        var registrations = [];
        if (type == "state") {
            var items = this._parseRegistrationItems(event);
            for (var i=0; i < items.length; i++) {
                var registration = Registration.fromObject(items[i]);
                registrations.push(registration);
            }
        }

        this._registrations = registrations;
        this._fire("registrations_changed", registrations);

        return true;
    }
};

/**
 * @private
 */
Ac.prototype._handleResourcesMessage = function(message) {
    // Resources exchange with server.
    var event = message.getChild("event", NS_AC_RESOURCE);
    if (event !== null) {
        var type = event.getAttribute("type");
        var id = event.getAttribute("call");
        var call = null;

        for (var c=0; c < this._calls.length; c++) {
            if (this._calls[c].getId() == id) {
                call = this._calls[c];
                break;
            }
        }

        if (call != null) {
            switch (type) {
                case "create":
                    this._handleResourcesAdded(call, this._parseResourcesItems(event));
                    break;
                case "update":
                    this._handleResourcesUpdated(call, this._parseResourcesItems(event));
                    break;
                case "delete":
                    this._handleResourcesRemoved(call, this._parseResourcesItems(event));
                    break;
            }
        }


        return true;
    }

    // Resources exchange between users
    var exchange = message.getChild("exchange", NS_AC_RESOURCE);
    if (exchange !== null) {
        var id = exchange.getAttribute("id");
        var meet = exchange.getAttribute("meet");
        var call = null;

        for (var c=0; c < this._calls.length; c++) {
            if (this._calls[c].getMeet() == meet) {
                call = this._calls[c];
                break;
            }
        }

        if (call != null) {
            var resource = call.getAnyResourceEmptyNull(id);

            if (resource != null) {
                resource.getHandler().onMessage(message, exchange);
            }
        }

        return true;
    }

};

/**
 * @private
 */
Ac.prototype._handleCallsAdded = function(items) {
    for (var i=0; i < items.length; i++) {
        var call = Call.fromObject(items[i]);
        var duplicate = false;

        for (var c=0; c < this._calls.length; c++) {
            if (this._calls[c].getId() == call.getId()) {
                duplicate = true;
                break;
            }
        }

        if (!duplicate) {
            this._calls.push(call);
            this._fire("call_added", call);
        }
    }
};

/**
 * @private
 */
Ac.prototype._handleCallsUpdated = function(items) {
    for (var i=0; i < items.length; i++) {
        var id = items[i].id;

        for (var c=0; c < this._calls.length; c++) {
            var call = this._calls[c];

            if (call.getId() === id) {
                var prev = this.clone(call);
                call.updateFromObject(items[i]);

                if (prev.getMeet() != call.getMeet()) {
                    // Cleanup resources
                    var resources = prev.getAllResources();

                    for (var r=0; r < resources.length; r++) {
                        var resource = resources[r];
                        try {
                            resource.getHandler().onDestroy();
                        } catch (e) {
                            console.error("An error occurs during resource destroy", e);
                        }

                        this._fire("call_resource_removed", call, resource);
                    }

                    call.updateResources([]);
                    call.updateMineResources([]);
                }

                this._fire("call_updated", call, prev);
            }
        }
    }
};

/**
 * @private
 */
Ac.prototype._handleCallsRemoved = function(items) {
    for (var i=0; i < items.length; i++) {
        var id = items[i].id;
        var cause = items[i].cause;
        var filtered = [];

        for (var c=0; c < this._calls.length; c++) {
            var call = this._calls[c];
            if (call.getId() !== id) {
                filtered.push(call);
            } else {
                call._state = "down";

                // Clean resources
                var resources = call.getAllResources()
                for (var r=0; r < resources.length; r++) {
                    var resource = resources[r];
                    try {
                        resource.getHandler().onDestroy();
                    } catch (e) {
                        console.error("An error occurs during resource destroy", e);
                    }

                    this._fire("call_resource_removed", call, resource);
                }



                this._fire("call_terminated", call, cause);
            }
        }

        this._calls = filtered;
    }
};

/**
 * @private
 */
Ac.prototype._handleCallsState = function(items) {
    return this._handleCallsAdded(items);
};

/**
 * @private
 */
Ac.prototype._handleResourcesAdded = function(call, items) {
    var added = [];
    var resources = call.getResources();


    for (var i=0; i < items.length; i++) {
        var resource = CallResource.fromObject(this._con, call.getMeet(), items[i]);
        added.push(resource);
        resources.push(resource);
    }

    call.updateResources(resources);

    for (var i=0; i < added.length; i++) {
        this._fire("call_resource_shared", call, added[i]);
    }
};

/**
 * @private
 */
Ac.prototype._handleResourcesUpdated = function(call, items) {
    var resources = call.getResources();

    for (var i=0; i < items.length; i++) {
        var id = items[i].id;

        for (var g=0; g < resources.length; g++) {
            var resource = resources[g];

            if (resource.getId() === id) {
                resource.updatePayload(items[i]['payload']);
                this._fire("call_resource_updated", call, resource);
            }
        }
    }
};

/**
 * @private
 */
Ac.prototype._handleResourcesRemoved = function(call, items) {
    var filtered = [];
    var removed = [];
    var resources = call.getResources();

    for (var i=0; i < items.length; i++) {
        var id = items[i].id;

        for (var i=0; i < resources.length; i++) {
            var resource = resources[i];
            if (resource.getId() !== id) {
                filtered.push(resource);
            } else {
                removed.push(resource);
            }
        }
    }

    call.updateResources(filtered);

    for (var i=0; i < removed.length; i++) {
        var resource = removed[i];
        resource.getHandler().onDestroy();

        this._fire("call_resource_removed", call, resource);
    }
};

// ============================================================
// Private functions
// ============================================================

/**
 * Generates a call originate command packet
 * @private
 */
Ac.prototype._createOriginatePacket = function(to) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_AC);
    var originate = packet.getDoc().createElement('originate');
    originate.setAttribute('to', to);
    originate.setAttribute('type', 'invite-all');
    query.appendChild(originate);

    return packet;
}

/**
 * Generates a call originate command packet
 * @private
 */
Ac.prototype._createOriginateUsingRegistrationPacket = function(to, registation) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_AC);
    var originate = packet.getDoc().createElement('originate');
    originate.setAttribute('to', to);
    originate.setAttribute('registration', registation.getId());
    originate.setAttribute('type', 'invite-one');
    query.appendChild(originate);

    return packet;
}

/**
 * Generates a call originate command packet
 * @private
 */
Ac.prototype._createOriginateUsingMobilityPacket = function(to, number) {
    var packet = new JSJaCIQ();
    packet.setType('set');
    var query = packet.setQuery(NS_AC);
    var originate  = packet.getDoc().createElement('originate');
    originate.setAttribute('to', to);
    originate.setAttribute('number', number);
    originate.setAttribute('type', 'mobility');
    query.appendChild(originate);

    return packet;
}

/**
 * Generates a call answer command packet
 * @private
 */
Ac.prototype._createAnswerCallPacket = function(call, channel) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var answer  = packet.getDoc().createElement('answer');
    answer.setAttribute('call', call.getId());
    answer.setAttribute('channel', channel.channelId);
    query.appendChild(answer);

    return packet;
};

/**
 * Generates a call hangup command packet
 * @private
 */
Ac.prototype._createHangUpCallPacket = function(call) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var hangup  = packet.getDoc().createElement('hangup');
    hangup.setAttribute('call', call.getId());
    query.appendChild(hangup);

    return packet;
};

/**
 * Generates a decline command packet
 * @private
 */
Ac.prototype._createDeclineCallPacket = function(call) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var hangup  = packet.getDoc().createElement('decline');
    hangup.setAttribute('call', call.getId());
    query.appendChild(hangup);

    return packet;
};

/**
 * Generates a hold command packet
 * @private
 */
Ac.prototype._createHoldPacket = function(call) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var hold  = packet.getDoc().createElement('hold');
    hold.setAttribute('call', call.getId());
    query.appendChild(hold);

    return packet;
};


/**
 * Generates a resume command packet
 * @private
 */
Ac.prototype._createResumePacket = function(call){
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var unhold = packet.getDoc().createElement('resume');
    unhold.setAttribute('call', call.getId());
    query.appendChild(unhold);

    return packet;
};

/**
 * Generates a mute command packet
 * @private
 */
Ac.prototype._createMutePacket = function(call){
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var unhold = packet.getDoc().createElement('mute');
    unhold.setAttribute('call', call.getId());
    query.appendChild(unhold);

    return packet;
};

/**
 * Generates a unmute command packet
 * @private
 */
Ac.prototype._createUnmutePacket = function(call){
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var unhold = packet.getDoc().createElement('unmute');
    unhold.setAttribute('call', call.getId());
    query.appendChild(unhold);

    return packet;
};

/**
 * Generates a record start command packet
 * @private
 */
Ac.prototype._createStartRecordPacket = function(call) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var record_start  = packet.getDoc().createElement('record-start');
    record_start.setAttribute('call', call.getId());
    query.appendChild(record_start);

    return packet;
};

/**
 * Generates a record stop command packet
 * @private
 */
Ac.prototype._createStopRecordPacket = function(call){
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var record_stop  = packet.getDoc().createElement('record-stop');
    record_stop.setAttribute('call', call.getId());
    query.appendChild(record_stop);

    return packet;
};

/**
 * Generates a forward command packet
 * @private
 */
Ac.prototype._createForwardPacket = function(call, to) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var forward  = packet.getDoc().createElement('forward');
    forward.setAttribute('call', call.getId());
    forward.setAttribute('to', to);
    query.appendChild(forward);

    return packet;
};

/**
 * Generates a bridge command packet
 * @private
 */
Ac.prototype._createBridgePacket = function(call1, call2) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var bridge = packet.getDoc().createElement('bridge');
    bridge.setAttribute('call1', call1.getId());
    bridge.setAttribute('call2', call2.getId());
    query.appendChild(bridge);

    return packet;
};

/**
 * Generates a bridge command packet
 * @private
 */
Ac.prototype._createDTMFPacket = function(call, key) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var bridge = packet.getDoc().createElement('dtmf');
    bridge.setAttribute('call', call.getId());
    bridge.setAttribute('key', key);
    query.appendChild(bridge);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createSpyPacket = function(jid) {
    var packet = new JSJaCIQ().setType('get');
    var query = packet.setQuery(NS_AC_SPY);
    query.setAttribute("jid", jid);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createSpyPickupPacket = function(call, registration) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var pickup = packet.getDoc().createElement('spy-pickup');
    pickup.setAttribute('call', typeof call === 'string' || call instanceof String ? call : call.getId());
    pickup.setAttribute('registration', registration.getId());
    query.appendChild(pickup);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createSpyIntrusionPacket = function(call, registration) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var intrusion = packet.getDoc().createElement('spy-intrusion');
    intrusion.setAttribute('call', typeof call === 'string' || call instanceof String ? call : call.getId());
    intrusion.setAttribute('registration', registration.getId());
    query.appendChild(intrusion);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createSpyDeclinePacket = function(call) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var decline = packet.getDoc().createElement('spy-decline');
    decline.setAttribute('call', call.getId());
    query.appendChild(decline);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createSpyTerminatePacket = function(call) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var terminate = packet.getDoc().createElement('spy-terminate');
    terminate.setAttribute('call', call.getId());
    query.appendChild(terminate);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createSharePacket = function(call, id, type, payload) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC);
    var share = packet.getDoc().createElement('share');
    share.setAttribute('call', call.getId());
    share.setAttribute('id', id);
    share.setAttribute('type', type);

    if (payload) {
        var p = packet.getDoc().createElement('payload');
        p.appendChild(packet.buildNode('data', {}, payload));
        share.appendChild(p);
    }

    query.appendChild(share);

    return packet;
};

/**
 * @private
 */
Ac.prototype._createDropPacket = function(call, id) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_AC); // TODO: Use NS_AC_RESOURCE instead ?
    var drop = packet.getDoc().createElement('drop');
    drop.setAttribute('call', call.getId());
    drop.setAttribute('id', id);
    query.appendChild(drop);

    return packet;
};


/**
 * @private
 */
Ac.prototype._createConsumePacket = function(call, resource) {
    var packet = new JSJaCIQ().setType('get');
    packet.setTo(resource.getOwner());
    var query = packet.setQuery(NS_AC_RESOURCE);
    query.setAttribute("id", resource.getId());
    query.setAttribute("meet", call.getMeet());
    query.appendChild(packet.getDoc().createElement('consume'));

    return packet;
};

/**
 * @private
 */
Ac.prototype._createUnconsumePacket = function(call, resource) {
    var packet = new JSJaCIQ().setType('get');
    packet.setTo(resource.getOwner());
    var query = packet.setQuery(NS_AC_RESOURCE);
    query.setAttribute("id", resource.getId());
    query.setAttribute("meet", call.getMeet());
    query.appendChild(packet.getDoc().createElement('unconsume'));

    return packet;
};

/**
 * @returns {Array}
 * @private
 */
Ac.prototype._parseCallItems = function(event) {
    var items = event.getElementsByTagName("call");
    var calls = [];

    for (var i=0; i < items.length; i++) {
        calls.push(this._parseCallItem(items.item(i)));
    }

    return calls;
};

/**
 * @returns {object}
 * @private
 */
Ac.prototype._parseCallItem = function(element) {
    var channels = [];
    var els = element.getElementsByTagName("channel");

    for (var i=0; i < els.length; i++) {
        var el = els.item(i);
        var id = el.getAttribute("id");
        var sipId = el.getAttribute("sip_id");
        var regId = el.getAttribute("reg_id");

        channels.push({channelId: id, sipId: sipId, regId: regId});
    }

    var meet = element.getAttribute('meet');
    var els = element.getElementsByTagName("resource");
    var resources = [];

    for (var i=0; i < els.length; i++) {
        var el = els.item(i);
        var resource = CallResource.fromObject(this._con, meet, this._parseResourceItem(el));

        resources.push(resource);
    }

    var flags = [];
    if (element.hasAttribute('flags')) {
        flags = element.getAttribute('flags').split(";");
    }

    var data = null;
    if (element.hasAttribute('callee_data')) {
        data = JSON.parse(element.getAttribute('callee_data'));
    }

    return {
        id: element.getAttribute('id'),
        channels: channels,
        state: element.getAttribute('state'),
        direction: element.getAttribute('direction'),
        calleeNumber: element.getAttribute('callee_number'),
        calleeName: element.getAttribute('callee_name'),
        calleeJid: element.getAttribute('callee_jid'),
        calleeId: element.getAttribute('callee_id'),
        calleeType: element.getAttribute('callee_type'),
        calleeData: data,
        info: element.getAttribute('info'),
        duration: element.getAttribute('duration'),
        flags: flags,
        meet: meet,
        cause: element.getAttribute('cause'),
        resources: resources
    }
};

/**
 * @returns {Array}
 * @private
 */
Ac.prototype._parseResourcesItems = function(event) {
    var items = event.getElementsByTagName("resource");
    var calls = [];

    for (var i=0; i < items.length; i++) {
        calls.push(this._parseResourceItem(items.item(i)));
    }

    return calls;
};

/**
 * @param element
 * @returns {object}
 * @private
 */
Ac.prototype._parseResourceItem = function(element) {
    var payload = null;
    var els = element.getElementsByTagName("payload");
    if (els.length > 0) {
        payload = els.item(0);
    }

    return {
        id: element.getAttribute('id'),
        type: element.getAttribute('type'),
        owner: element.getAttribute('owner'),
        payload: payload
    }
};


/**
 * @returns {Array}
 * @private
 */
Ac.prototype._parseRegistrationItems = function(event) {
    var items = event.getElementsByTagName("registration");
    var registrations = [];

    for (var i=0; i < items.length; i++) {
        registrations.push(this._parseRegistrationItem(items.item(i)));
    }

    return registrations;
}


/**
 * @returns {object}
 * @private
 */
Ac.prototype._parseRegistrationItem = function(element) {
    return {
        id: element.getAttribute('id'),
        ip: element.getAttribute('ip'),
        port: element.getAttribute('port'),
        ua: element.getAttribute('ua')
    }
};

/**
 * @returns {{error_handler: Function, result_handler: Function}}
 * @private
 */
Ac.prototype._proxyIqCallback = function(callback, scope) {
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

            callback.call(scope, reason, iq);
        },
        result_handler: function(iq) {
            callback.call(scope, null, iq);
        }
    }
};



/**
 * @returns {{result_handler: Function}}
 * @private
 */
Ac.prototype._proxyIqSpy = function(callback, scope) {
    var me = this;
    return {
        result_handler: function(iq) {
            var node = iq.getNode();
            var items = me._parseCallItems(node);
            var calls = [];
            for (var i=0; i < items.length; i++) {
                calls.push(Call.fromObject(items[i]));
            }

            callback.call(scope, calls);
        }
    }
}

Ac.prototype.clone = function(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = new obj.constructor;
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

// ============================================================
// Shared classes
// ============================================================


/**
 * @constructor
 */
function Registration(id, ip, port, ua) {
    this._id = id;
    this._ip = ip;
    this._port = port;
    this._ua = ua;
}

/**
 * Returns unique id of current registration
 *
 * @public
 */
Registration.prototype.getId = function() {
    return this._id;
}

/**
 * @public
 */
Registration.prototype.getIp = function() {
    return this._ip;
}

/**
 * @public
 */
Registration.prototype.getPort = function() {
    return this._port;
}

/**
 * @public
 */
Registration.prototype.getUserAgent = function() {
    return this._ua;
}

/**
 * Creates a new Registration using json object
 *
 * @param {object} params
 * @private
 * @returns {Registration}
 */
Registration.fromObject = function(params) {
    return new Registration(params.id, params.ip, params.port, params.ua);
}


/**
 * @public
 * @constructor
 */
function Call(id, channels, calleeNumber, calleeName, calleeJid, calleeId, calleeType, calleeData, info, duration, state, direction, flags, meet, resources) {
    this._className = 'Call';
    this._id = id;
    this._channels = channels;
    this._calleeNumber = calleeNumber;
    this._calleeName = calleeName;
    this._calleeJid = calleeJid;
    this._calleeId = calleeId;
    this._calleeType = calleeType;
    this._calleeData = calleeData;
    this._duration = parseInt(duration);
    this._durationTime = Math.round(new Date().getTime() / 1000);
    this._state = state;
    this._direction = direction;
    this._flags = flags;
    this._extraFlags = [];
    this._meet = meet;
    this._resources = resources;
    this._mineResources  = [];
}

Call.fromObject = function(o) {
    return new Call(o.id, o.channels, o.calleeNumber, o.calleeName, o.calleeJid, o.calleeId, o.calleeType, o.calleeData, o.info, o.duration, o.state, o.direction, o.flags, o.meet, o.resources);
};

/**
 * @private
 */
Call.prototype.updateFromObject = function(o) {
    this._channels = o.channels;
    this._calleeNumber = o.calleeNumber;
    this._calleeName = o.calleeName;
    this._calleeJid = o.calleeJid;
    this._calleeId = o.calleeId;
    this._calleeType = o.calleeType;
    this._calleeData = o.calleeData;
    this._info = o.info;
    this._duration = parseInt(o.duration);
    this._durationTime = Math.round(new Date().getTime() / 1000);
    this._state = o.state;
    this._flags = o.flags;
    this._meet = o.meet;
};

/**
 * @private
 */
Call.prototype.updateResources = function(resources) {
    this._resources = resources;
};

/**
 * @private
 */
Call.prototype.updateMineResources = function(resources) {
    this._mineResources = resources;
};

/**
 * @private
 */
Call.prototype.getClassName = function() {
    return this._className;
};

/**
 * Returns a call id
 *
 * @returns {String}
 */
Call.prototype.getId = function() {
    return this._id;
};

/**
 * Returns channels for current call.
 * Should be used to be able to answer on a specified channel (device).
 * E.g. each channel is a probably "one registration call"
 *
 * @returns {Array.<Object>}
 */
Call.prototype.getChannels = function() {
    return this._channels;
};

/**
 * @returns {boolean}
 */
Call.prototype.isInfoExists = function() {
    return this._info != null && this._info != '';
};

/**
 * @returns {Object}
 */
Call.prototype.getInfo = function() {
    return this._info;
};

/**
 * Returns a call direction, "incoming" or "outgoing"
 *
 * @returns {String}
 */
Call.prototype.getDirection = function() {
    return this._direction;
};

/**
 * Returns a list of flags for this call
 *
 * @returns {Array.<String>}
 */
Call.prototype.getFlags = function() {
    return this._flags;
};

/**
 * Returns a list of flags for this call
 *
 * @returns {Array.<String>}
 */
Call.prototype.getExtraFlags = function() {
    return this._extraFlags;
};

Call.prototype.isExtraFlagExist = function(item) {
    return this._extraFlags.indexOf(item) > -1;
};

Call.prototype.addExtraFlag = function(item) {
    this._extraFlags.push(item);
};

Call.prototype.removeExtraFlag = function(item) {
    var index = this._extraFlags.indexOf(item);
    if (index > -1) {
        this._extraFlags.splice(index, 1);
    }
};

/**
 * Returns a meeting ID.
 *
 * @returns {*}
 */
Call.prototype.getMeet = function() {
    return this._meet;
};

Call.prototype.isMeetAvailable = function() {
    return this._meet != null;
};

Call.prototype.getResources = function() {
    return this._resources;
};

Call.prototype.getResource = function(id) {
    var resource = this.getResourceEmptyNull(id);
    if (resource == null) {
        throw new Error("There are no resource with \""+ id +"\" id");
    }

    return resource;
};

Call.prototype.getResourceEmptyNull = function(id) {
    for (var i=0; i < this._resources.length; i++) {
        if (this._resources[i].getId() == id) {
            return this._resources[i];
        }
    }

    return null;
};

Call.prototype.getAnyResourceEmptyNull = function(id) {
    var resource = this.getResourceEmptyNull(id);

    if (!resource) {
        var resources = this.getMineResources();
        for (var i=0; i < resources.length; i++) {
            if (resources[i].getId() == id) {
                return resources[i];
            }
        }
    }

    return resource;
};

Call.prototype.getMineResources = function() {
    return this._mineResources.slice(0);
};

Call.prototype.getAllResources = function() {
    return this._mineResources.slice(0).concat(this._resources);
};


/**
 * Returns a duration of call in seconds.
 *
 * @public
 * @returns {int}
 */
Call.prototype.getDuration = function() {
    var time = Math.round(new Date().getTime() / 1000);
    var offset = time - this._durationTime;
    return this._duration + offset;
};

/**
 * Returns a duration in "MM:SS" format.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getFormattedDuration = function() {
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
Call.prototype.getCalleeName = function() {
    return this._calleeName;
};

/**
 * Returns the phone number of the other participant.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getCalleeNumber = function() {
    return this._calleeNumber;
};

/**
 * Returns the JID of the other participant.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getCalleeJid = function() {
    if (this._calleeJid && this._calleeJid.length > 0) {
        return this._calleeJid;
    }

    return null;
};

/**
 * @public
 * @returns {string}
 */
Call.prototype.getCalleeId = function() {
    return this._calleeId;
};

/**
 * @public
 * @returns {string}
 */
Call.prototype.getCalleeType = function() {
    return this._calleeType;
};

/**
 * Returns the JID of the other participant.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getCalleeData = function() {
    return this._calleeData;
};

/**
 * Returns description about Callee.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getCalleeDescription = function() {
    return this.getCalleeType() + " " + this.getFormattedCalleeName() + " ("+ this.getCalleeId() +")";
};

/**
 * Returns a participant name in format "NAME <NUMBER>" or "NUMBER" when name is not available.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getFormattedCalleeName = function() {
    if (this._calleeName.length > 0) {
        return this._calleeName + " <"+ this._calleeNumber +">";
    }

    return this._calleeNumber;
};

/**
 * Returns a state of a call.
 * Possible states are: ring, hold, up.
 * ring - when call is not answered.
 * hold - when call is on hold.
 * up - when call is answered and not on a hold.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getState = function() {
    return this._state;
};

/**
 * Returns the human-readable state of a call.
 * Possible returns values are: Ringing, Paused, Connected.
 *
 * @public
 * @returns {string}
 */
Call.prototype.getFormattedState = function() {
    switch (this._state) {
        case "ring":
            return "Ringing";
        case "hold":
            return "Paused";
        case "up":
            return "Connected";
    }
};

/**
 * Returns true if this call is incoming.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isIncoming = function() {
    return this.getDirection() == "incoming";
};

/**
 * Returns true if this call is outgoing.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isOutgoing = function() {
    return this.getDirection() == "outgoing";
};



/**
 * Returns true if this call cal be transferred.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isMuted = function() {
    return this._flags.indexOf("muted") != -1;
};

/**
 * Returns true if this call cal be transferred.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isTransferable = function() {
    return this._flags.indexOf("transferable") != -1;
};

/**
 * Returns true if this call are recorded.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isRecorded = function() {
    return this._flags.indexOf("recorded") != -1;
};

/**
 * Returns true if this call is active.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isActive = function() {
    return this._state == "active";
};

/**
 * Returns true if this call are in "ring" state (not answered yet).
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isRinging = function() {
    return this._state == "ringing" || this._state == "early";
};

/**
 * Returns true if this call is terminated.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isTerminated = function() {
    return this._state == "down";
}
/**
 * Returns true if this call are on hold.
 *
 * @public
 * @returns {boolean}
 */
Call.prototype.isOnHold = function() {
    switch (this._state) {
        case "pausing":
        case "paused":
        case "onhold":
        case "held":
            return true;
        default:
            return false;
    }
}

Call.prototype.getSimpleStatus = function() {
    if (this.isActive() || this.isOnHold()) {
        return "active";
    } else if (this.isRinging()) {
        return "ringing";
    } else if (this.isTerminated()) {
        return "down";
    } else {
        return "active";
    }
};

Call.prototype.getSimpleStatusClasses = function() {
    var classes = [];
    classes.push("call-" + this.getSimpleStatus());

    if (this.isOnHold()) {
        classes.push("call-held");
    }
    if (this.isTransferable()) {
        classes.push("call-transferable");
    }
    if (this.isRecorded()) {
        classes.push("call-recorded");
    }
    if (this.isMuted()) {
        classes.push("call-muted");
    }
    if (this.isMeetAvailable()) {
        classes.push("call-meet");
    }
    if (this.isOutgoing()) {
        classes.push("call-outgoing");
    } else {
        classes.push("call-incoming");
    }

    return classes;
};

Call.prototype.getPossibleSimpleStatusClasses = function() {
    return [
        "call-active",
        "call-ringing",
        "call-onhold",
        "call-down",
        "call-invalid",
        "call-transferable",
        "call-outgoing",
        "call-incoming",
        "call-meetable",
        "call-recorded",
        "call-muted"
    ];
};

function CallResource(connection, meet, id, type, owner, payload) {
    this._id = id;
    this._type = type;
    this._owner = owner;
    this._payload = payload;
    this._meet = meet;
}

/**
 * @private
 */
CallResource.fromObject = function(connection, meet, o) {
    return new CallResource(connection, meet, o.id, o.type, o.owner, o.payload);
};

/**
 * @private
 */
CallResource.prototype.updatePayload = function(payload) {
    this._payload = payload;
};

CallResource.prototype.getId = function() {
    return this._id;
};

CallResource.prototype.getType = function() {
    return this._type;
};

CallResource.prototype.getOwner = function() {
    return this._owner;
};

CallResource.prototype.getPayload = function() {
    return this._payload;
};

CallResource.prototype.getMeet = function() {
    return this._meet;
};

CallResource.prototype.getSubscriber = function() {
    return this._subscriber;
};

CallResource.prototype.getHandler = function() {
    return this._subscriber;
};

function CallMineResource(id, type, publisher) {
    this._id = id;
    this._type = type;
    this._publisher = publisher;
}

CallMineResource.prototype.getId = function() {
    return this._id;
};

CallMineResource.prototype.getType = function() {
    return this._type;
};

CallMineResource.prototype.getHandler = function() {
    return this._publisher;
};

export {
    Ac,
    Registration,
    Call,
    CallResource,
    CallMineResource
}