import Observable from './Observable';
import {JSJaCIQ, JSJaCPresence, JSJaCPacket} from './jsjac';

var NS_PRESENCE = "urn:carusto:presence";

/**
 * @param connection
 * @constructor
 */
function Presences(connection) {
    this._con = connection;
    this._con.registerHandler("iq", this._handleIQ, this, 10);
    this._con.registerHandler("presence", this._handlePresence, this, 10);
    this._con.addListener("connected", this._onConnected, this);
    this._con.addListener("disconnected", this._onDisconnected, this);
    this._colleagues = this._con.contacts;

    this._presences = {}; // A list of available presences
    this._empty_presence = new Presence();
    this._personal_presence = this._empty_presence;

    // Initialize supper
    Observable.call(this);
};

Presences.prototype = Object.create(Observable.prototype);

// ============================================================
// Public events
// ============================================================

/**
 * Indicates that new message is received from remote contact.
 *
 * @event Conversations#message_received
 * @property {Contact} contact
 * @property {Message} message
 */

/**
 * Indicates that previously message has been send.
 *
 * @event Conversations#message_send
 * @property {Contact} contact
 * @property {Message} message
 */

// ============================================================
// Public functions
// ============================================================

/**
 * Returns a presence of current
 *
 * @returns {Presence}
 */
Presences.prototype.getPersonalPresence = function() {
    return this._personal_presence;
}

/**
 *
 *
 * @param {Presence} presence
 * @param {function} callback
 */
Presences.prototype.changePersonalPresence = function(presence, callback, scope) {
    if (!(presence instanceof Presence)) {
        throw new Error("Presence should be an instance of Presence");
    }

    var packet = this._createSetPresencePacket(presence);
    var handler = this._createSetPresenceHandler(callback, scope);
    this._con.sendIQ(packet, handler);
}

/**
 * Returns the presence info for a particular contact.
 *
 * @param {Contact} contact
 * @returns {Presence}
 */
Presences.prototype.get = function(contact) {
    var jid = contact.getJid()
    return jid in this._presences ? this._presences[jid] : this._empty_presence;
}

// ============================================================
// Private functions
// ============================================================

/**
 * @private
 */
Presences.prototype._onConnected = function() {
    // Format packet to receive personal presence.
    this._con.sendIQ(
        this._createGetPersonalPresencePacket(),
        this._createGetPersonalPresenceHandler()
    );
}

/**
 * @private
 * @fires Presences#presence_changed
 * @fires Presences#personal_presence_changed
 */
Presences.prototype._onDisconnected = function() {
    // Set all available presences to unavailable.
    for(var jid in this._presences) {
        this._presences[jid] = this._empty_presence;
        var contact = this._colleagues.getColleague(jid);
        if (contact !== null) {
            this._fire("presence_changed", contact, this._empty_presence);
        }
    }

    this._presences = {};
    this._personal_presence = this._empty_presence;
    this._fire("personal_presence_changed", this._personal_presence);
}

/**
 *
 * @param iq
 * @returns {boolean}
 * @private
 */
Presences.prototype._handleIQ = function(iq) {
    if (iq.getQueryXMLNS() == NS_PRESENCE) {
        this._personal_presence = this._parsePersonalPresence(iq.getNode()).build();
        this._fire("personal_presence_changed", this._personal_presence);
        return true;
    }

    return false;
}

/**
 *
 * @param {JSJaCPresence} packet
 * @private
 */
Presences.prototype._handlePresence = function(packet) {
    var from = packet.getFromJID();
    var node = packet.getNode();
    var jid = from.removeResource().toString();
    var presence = this._parsePresence(node).build();

    if (jid == this._con.getJid()) {
        return;
    }

    // lookup contact
    // ---
    var contact = this._colleagues.getColleague(jid);
    if (contact === null) {
        var callback = function(contact) {
            if (contact !== null) {
                this._handlePresenceChange(contact, presence);
            }
        };

        this._colleagues.lookupColleague(jid, callback, this);
    } else {
        this._handlePresenceChange(contact, presence);
    }
}

Presences.prototype._handlePresenceChange = function(contact, presence) {
    var prevPresence = contact.getPresence();

    contact._presence = presence;

    this._presences[contact.getJid()] = presence;
    this._fire("presence_changed", contact, presence);

    // Fire ...
    var prevResources = prevPresence.getResources();
    var newResources = presence.getResources();
    var diffResources = [];

    for (var i=0; i < prevResources.length; i++) {
        if (newResources.indexOf(prevResources[i]) == -1) {
            diffResources.push(prevResources[i])
        }
    }

    for (var i=0; i < newResources.length; i++) {
        if (prevResources.indexOf(newResources[i]) == -1) {
            diffResources.push(newResources[i]);
        }
    }

    for (var i=0; i < diffResources.length; i++) {
        var resource = diffResources[i];
        var type = newResources.indexOf(resource) == -1 ? "unavailable" : "available";
        this._fire("presence_resource", contact, resource, type);
    }
}

// ============================================================
// Shared classes
// ============================================================

Presences.prototype._createGetPersonalPresencePacket = function() {
    var packet = new JSJaCIQ().setType('get');
    packet.setQuery(NS_PRESENCE);
    return packet;
}

Presences.prototype._createGetPersonalPresenceHandler = function() {
    var self = this;
    return {
        result_handler: function(iq) {
            self._personal_presence = self._parsePersonalPresence(iq.getNode()).build();
            self._fire("personal_presence_changed", self._personal_presence);
        },
        error_handler: function() {
            // Notify about it
        }
    }
}

/**
 *
 *
 * @param presence
 * @returns {JSJaCPacket}
 * @private
 */
Presences.prototype._createSetPresencePacket = function(presence) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_PRESENCE);
    var extra = packet.getDoc().createElement('extra');

    // Create show element
    if (presence.isAway() || presence.isDND()) {
        query.appendChild(packet.buildNode('show', {}, presence.isAway() ? "away" : "dnd"));
    }

    // Create status message element
    if (presence.isMessageAvailable()) {
        query.appendChild(packet.buildNode('status', {}, presence.getMessage()));
    }

    // Crate location element
    if (presence.isLocationAvailable()) {
        var l = presence.getLocation();
        var loc = packet.getDoc().createElementNS('urn:carusto:location', 'location');
        loc.setAttribute("address", l.getAddress());
        loc.setAttribute("lat", l.getLatitude());
        loc.setAttribute("lng", l.getLongitude());

        query.appendChild(loc);
    }

    if (extra.childNodes.length > 0) {
        query.appendChild(extra);
    }

    return packet;
}

/**
 *
 * @param callback
 * @param scope
 * @returns {{result_handler: Function, error_handler: Function}}
 * @private
 */
Presences.prototype._createSetPresenceHandler = function(callback, scope) {
    var self = this;
    return {
        result_handler: function(iq) {
            self._personal_presence = self._parsePersonalPresence(iq.getNode()).build();
            self._fire("personal_presence_changed", self._personal_presence);
            if (typeof callback == 'function') {
                callback.call(scope, self._personal_presence);
            }
        },
        error_handler: function() {
            if (typeof callback == 'function') {
                callback.call(scope, self._personal_presence);
            }
        }
    }
}

/**
 *
 * @param {Node} node
 * @returns {Presence.Builder}
 * @private
 */
Presences.prototype._parsePresence = function(node) {
    var builder = new Presence.Builder();

    // Determine online / offline status
    if (!node.hasAttribute("type") || node.getAttribute("type") != "unavailable") {
        builder.setOnline();
    }

    // Determine user status (away / dnd)
    var show = node.getElementsByTagName('show');
    if (show.length > 0 && show.item(0).firstChild) {
        switch (show.item(0).firstChild.nodeValue) {
            case "away":
                builder.setAway();
                break;
            case "dnd":
                builder.setDND();
                break;
        }
    }

    // Determine status message
    var status_msg = node.getElementsByTagName('status');
    if (status_msg.length > 0 && status_msg.item(0).firstChild) {
        builder.setMessage(status_msg.item(0).firstChild.nodeValue);
    }

    var extra = node.getElementsByTagName('extra');
    if (extra.length > 0) {
        extra = extra.item(0);

        // Determine phone status (ringing / talking / rt)
        var phoneStatus = extra.getElementsByTagName('phone');
        if (phoneStatus.length > 0 && phoneStatus.item(0).firstChild) {
            switch (phoneStatus.item(0).firstChild.nodeValue) {
                case "ringing":
                    builder.setRinging();
                    break;
                case "talking":
                    builder.setTalking();
                    break;
                case "rt":
                    builder.setRingingAndTalking();
                    break;
            }
        }
    }

    // Determine location
    var location = null;
    var ls = node.getElementsByTagName('location');
    if (ls.length > 0) {
        ls = ls.item(0);

        var address = ls.getAttribute("address");
        var lat = ls.getAttribute("lat");
        var lng = ls.getAttribute("lng");

        location = new Presence.Location(address, lat, lng);
    }

    builder.setLocation(location);

    // Determine resources
    var resources = [];
    var rs = node.getElementsByTagName('resources');
    if (rs.length > 0) {
        rs = rs.item(0).getElementsByTagName('resource');

        for (var i=0; i < rs.length; i++) {
            resources.push(rs.item(i).firstChild.nodeValue);
        }
    }

    builder.setResources(resources);

    // Determine registrations
    var registrations = [];
    var rs = node.getElementsByTagName('registrations');
    if (rs.length > 0) {
        rs = rs.item(0).getElementsByTagName('registration');

        for (var i=0; i < rs.length; i++) {
            var r = rs.item(i);
            registrations.push({
                token: r.getAttribute("token"),
                ua: r.getAttribute("ua")
            });
        }
    }

    builder.setRegistrations(registrations);

    return builder;
};

/**
 *
 * @param node
 * @returns {Presence.Builder}
 * @private
 */
Presences.prototype._parsePersonalPresence = function(node) {
    return this._parsePresence(node).setOnline();
};

// ============================================================
// Shared classes
// ============================================================


/**
 * Represents a Presence of a User.
 * Use Presence.Builder to create a new presence.
 *
 * @public
 * @constructor
 */
function Presence() {
    this._online = false;
    this._show = Presence.NONE;
    this._phoneStatus = Presence.NONE;
    this._status = null;
    this._location = null;
    this._resources = [];
    this._registrations = [];
}

Presence.NONE = 0;
Presence.AWAY = 1;
Presence.DND = 2;
Presence.RINGING = 3;
Presence.TALKING = 4;
Presence.RT = 5;

/**
 * Returns true if user is online (available) and false if the user is offline (unavailable).
 *
 * @returns {boolean}
 */
Presence.prototype.isOnline = function() {
    return this._online;
}

/**
 * Returns true if user set away status.
 *
 * @returns {boolean}
 */
Presence.prototype.isAway = function() {
    return this._show === Presence.AWAY;
}

/**
 * Returns true if user set DND status.
 *
 * @returns {boolean}
 */
Presence.prototype.isDND = function() {
    return this._show === Presence.DND;
}

/**
 * Returns true if somebody is calling to user.
 *
 * @returns {boolean}
 */
Presence.prototype.isRinging = function() {
    return (this._phoneStatus === Presence.RINGING || this._phoneStatus === Presence.RT);
}


/**
 * Returns true if user is talking with somebody.
 *
 * @returns {boolean}
 */
Presence.prototype.isTalking = function() {
    return (this._phoneStatus === Presence.TALKING || this._phoneStatus === Presence.RT);
}

/**
 * Returns true if user is talking and somebody tries to call him.
 *
 * @returns {boolean}
 */
Presence.prototype.isTalkingAndRinging = function() {
    return this._phoneStatus === Presence.RT;
}

/**
 * Returns true if user is offline and has default values for other properties.
 *
 * @returns {boolean}
 */
Presence.prototype.isEmpty = function() {
    if (this._show !== Presence.NONE ||
        this._phoneStatus !== Presence.NONE ||
        this._status !== null) {
        return false;
    }

    return true;
}

/**
 * Returns a status icon representing a current status.
 * Possible values:
 *  away
 *  away-offline
 *  dnd
 *  dnd-offline
 *  online
 *  offline
 *
 * @returns {String}
 */
Presence.prototype.getStatusIcon = function() {
    switch (this._show) {
        case Presence.AWAY:
            return this._online ? "away" : "away-offline"
        case Presence.DND:
            return this._online ? "dnd" : "dnd-offline"
        default:
            return this._online ? "online" : "offline"
    }
}

/**
 * Returns a status icon representing a current phone status.
 * Possible values:
 *  ringing
 *  talking
 *  rt
 *
 * @returns {string}
 */
Presence.prototype.getPhoneStatusIcon = function() {
    switch (this._phoneStatus) {
        case Presence.RINGING:
            return "ringing";
        case Presence.TALKING:
            return "talking";
        case Presence.RT:
            return "talking";
        default:
            return "none";
    }
};

/**
 * Returns the status message of the presence, or null if user doesn't set it.
 *
 * @returns {String|null}
 */
Presence.prototype.getMessage = function() {
    return this._status;
};

/**
 * Returns true if user set custom status message.
 *
 * @returns {boolean}
 */
Presence.prototype.isMessageAvailable = function() {
    return this._status !== null;
};

/**
 * Returns Location
 *
 * @returns {Object|null}
 */
Presence.prototype.getLocation = function() {
    return this._location;
};

/**
 * Returns true if presence contains location.
 *
 * @returns {boolean}
 */
Presence.prototype.isLocationAvailable = function() {
    return this._location !== null;
};

/**
 * Returns a list of connected resources
 *
 * @returns {Array}
 */
Presence.prototype.getResources = function() {
    return this._resources;
};

/**
 * Returns a list of connected registrations
 *
 * @returns {Array}
 */
Presence.prototype.getRegistrations = function() {
    return this._registrations;
};

/**
 * @returns boolean
 */
Presence.prototype.isAnyRegistration = function() {
    return this._registrations > 0;
};

Presence.fromObject = function(obj) {
    var builder = new Presence.Builder();

    if (obj['online']) {
        builder.setOnline();
    }

    switch (obj['status']) {
        case 'away':
            builder.setAway();
            break;
        case 'dnd':
            builder.setDND();
            break;
    }

    switch (obj['phone_status']) {
        case 'ringing':
            builder.setRinging();
            break;
        case 'talking':
            builder.setTalking();
            break;
        case 'rt':
            builder.setRingingAndTalking();
            break;
    }

    if (obj['message']) {
        builder.setMessage(obj['message']);
    }

    if (obj['resources'] && obj['resources']['length'] > 0) {
        builder.setResources(obj['resources']);
    }

    if (obj['registrations'] && obj['registrations']['length'] > 0) {
        builder.setRegistrations(obj['registrations']);
    }

    if (obj.hasOwnProperty("location") && obj['location']) {
        builder.setLocation(new Presence.Location(obj['location']['address'], obj['location']['lat'], obj['location']['lng']));
    }

    return builder.build();
};

/**
 * @returns {object}
 * @constructor
 */
Presence.Builder = function(original) {
    // Set status
    var presence = new Presence();

    if (original) {
        presence._online = original._online;
        presence._show = original._show;
        presence._phoneStatus = original._phoneStatus;
        presence._status = original._status;
        presence._location = original._location;
        presence._resources = original._resources;
        presence._registrations = original._registrations;
    }

    return {
        setOnline: function() {
            presence._online = true;
            return this;
        },
        setAway: function() {
            presence._show = Presence.AWAY;
            return this;
        },
        setDND: function() {
            presence._show = Presence.DND;
            return this;
        },
        setRinging: function() {
            presence._phoneStatus = Presence.RINGING;
            return this;
        },
        setTalking: function() {
            presence._phoneStatus = Presence.TALKING;
            return this;
        },
        setRingingAndTalking: function() {
            presence._phoneStatus = Presence.RT;
            return this;
        },
        setMessage: function(message) {
            presence._status = message;
            return this;
        },
        setResources: function(resources) {
            presence._resources = resources;
            return this;
        },
        setRegistrations: function(registrations) {
            presence._registrations = registrations;
            return this;
        },
        setLocation: function(location) {
            presence._location = location;
            return this;
        },
        build: function() {
            return presence;
        }
    }
};

/**
 * @constructor
 */
Presence.Location = function(address, lat, lng) {
    this._address = address;
    this._lat = lat;
    this._lng = lng;
};

Presence.Location.prototype.equals = function(location) {
    if (location._address == this._address &&
        location._lat == this._lat &&
        location._lng == this._lng) {
        return true;
    }

    return false;
};
Presence.Location.prototype.getAddress = function() {
    return this._address;
};

Presence.Location.prototype.getLatitude = function() {
    return this._lat;
};

Presence.Location.prototype.getLongitude = function() {
    return this._lng;
};


export {
    Presences,
    Presence
};