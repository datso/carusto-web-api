import Observable from './Observable';
import {createRestPacket, createRestHandler} from './Rest';
import {color} from './Utils';

var NS_HISTORY = "urn:carusto:history";

/**
 * Constructor for Conversations.
 *
 * @alias Conversations
 * @public
 * @constructor
 */
function Conversations(connection) {
    this._con = connection;
    this._con.registerHandler("message", this._handleMessage, this, 100);

    // Initialize supper
    Observable.call(this);
}

Conversations.prototype = Object.create(Observable.prototype);

// ============================================================
// Public events
// ============================================================

/**
 * Indicates that new message is received from remote contact.
 *
 * @event carusto.Conversations#message_received
 * @property {Contact} contact
 * @property {Message} message
 */

/**
 * Indicates that message has been send to remote contact.
 *
 * @event carusto.Conversations#message_send
 * @property {Contact} contact
 * @property {Message} message
 */

/**
 * Indicates that remote contact reads message.
 *
 * @event carusto.Conversations#message_delivered
 * @property {Contact} contact
 * @property {Message} message
 */

// ============================================================
// Public functions
// ============================================================

/**
 * Sends a message to user.
 *
 * @param {Contact} contact
 * @param {string} body
 */
Conversations.prototype.send = function(contact, body) {
    var packet = new JSJaCMessage();
    packet.setTo(contact.getJid());
    packet.setType('chat');
    packet.setBody(carusto.text(body));

    this._con.send(packet);
};


/**
 * Sends a notification that message are read by user.
 *
 * @param {Contact} contact A user that send message
 * @param {Message} message
 */
Conversations.prototype.sendDeliveryConfirmation = function(contact, message) {
    var packet = new JSJaCMessage();
    packet.setTo(contact.getJid());
    packet.setType('chat');
    packet.appendNode('received', {'xmlns': 'urn:xmpp:receipts', 'id': message.getId()});

    this._con.send(packet);
};

/**
 * Retrieves a history from server for a specified participant.
 *
 * @param {Contact} contact Participant
 * @param {int} limit
 * @param {int} offset
 * @param {function} callback
 * @param {object} scope
 */
Conversations.prototype.getHistory = function(contact, limit, offset, callback, scope) {
    var packet = this._createGetHistoryElement(contact.getJid(), limit, offset);
    var handler = this._con._handleIQCallback(this._handleGetHistoryResponse, this, [contact, callback, scope]);
    this._con.sendIQ(packet, handler);
};

// ============================================================
// Conversations callbacks
// ============================================================

/**
 * @private
 */
Conversations.prototype._handleMessage = function(packet) {
    if (this._handleMessageFallback(packet)) {
        return true;
    } else if (this._handleMessageDelivery(packet)) {
        return false;
    }

    // Default chat message handling
    var type = packet.getType();
    var body = packet.getBody();
    var node = packet.getNode();

    if (!(type == "" || type == "chat" || type == "normal") || body.length == 0) {
        return false;
    }

    /** @type String */
    var participant = null;
    /** @type Message */
    var message = null;

    try {
        var id = packet.getID();
        var delay = node.getElementsByTagName("delay")[0];
        var time = new Date(delay.getAttribute("stamp"));
        var from = packet.getFromJID().removeResource().toString();
        var to = packet.getToJID().removeResource().toString();
        var direction = Message.INCOMING;

        participant = from;
        body = body.replace(/\\\\/g, '\\');
        message = new carusto.Message(id, from, to, direction, body, time, true);
    } catch (e) {
        // TODO: Fire error to carusto fallback
        return;
    }

    var callback = function(contact) {
        if (contact) {
            this._fire("message_received", contact, message);
        }
    };

    if (participant && message) {
        this._con.contacts.retrieveColleague(participant, callback, this);
    }
};



/**
 * Parse fallback message:
 * <message from="657566@example.carusto.com" to="657566@example.carusto.com/Vadim" >
 *    <fallback xmlns="urn:carusto:history">
 *        <message from="657566@example.carusto.com" type="chat" to="557758@example.carusto.com" id="1016" >
 *            <body>test</body>
 *            <delay xmlns="urn:xmpp:delay" stamp="2013-11-15T21:09:53Z" />
 *        </message>
 *    </fallback>
 * </message>
 *
 * @private
 */
Conversations.prototype._handleMessageFallback = function(packet) {
    var els = packet.getNode().getElementsByTagName('fallback');
    if (els.length == 1) {
        /** @type String */
        var participant = null;
        /** @type Message */
        var message = null;

        try {
            var fallback = els.item(0).getElementsByTagName('message')[0];
            var from = fallback.getAttribute('from');
            var to = fallback.getAttribute('to');
            var id = fallback.getAttribute('id');
            var body = fallback.getElementsByTagName("body")[0].textContent;
            var delay = fallback.getElementsByTagName("delay")[0];
            var time = new Date(delay.getAttribute("stamp"));
            var direction = Message.OUTGOING;

            participant = fallback.getAttribute('to');
            body = body.replace(/\\\\/g, '\\');
            message = new Message(id, from, to, direction, body, time, false);
        } catch (e) {
            // TODO: Fire error to carusto fallback
            return;
        }

        var callback = function(contact) {
            if (contact) {
                this._fire("message_send", contact, message);
            }
        };

        if (participant && message) {
            this._con.contacts.retrieveColleague(participant, callback, this);
        }
    }
};

/**
 * @private
 */
Conversations.prototype._handleMessageDelivery = function(packet) {
    var els = packet.getNode().getElementsByTagName('received');
    if (els.length == 1) {
        var received = els.item(0);
        var id = received.getAttribute('id');
        var from = packet.getFromJID();
        var jid = from.removeResource().toString();

        var callback = function(contact) {
            if (contact) {
                this._fire("message_delivered", contact, id);
            }
        };

        this._con.contacts.retrieveColleague(jid, callback, this);
        return true;
    }

    return false;
};

// ============================================================
// Private functionality
// ============================================================

/**
 * @private
 */
Conversations.prototype._createGetHistoryElement = function(jid, limit, offset) {
    var packet = new JSJaCIQ().setType('get');
    var query = packet.setQuery(NS_HISTORY);
    query.setAttribute("jid", jid);
    query.setAttribute("limit", limit);
    query.setAttribute("offset", offset);
    return packet;
};

/**
 * @private
 */
Conversations.prototype._handleGetHistoryResponse = function(iq, contact, callback, scope) {
    var node = iq.getNode();
    var els = node.getElementsByTagName("message");
    var messages = [];

    for (var i=0; i < els.length; i++) {
        var el = els.item(i);

        var id = el.getAttribute("id");
        var delay = el.getElementsByTagName("delay")[0];
        var time = new Date(delay.getAttribute("stamp"));
        var body = el.getElementsByTagName("body")[0].textContent;
        var from = el.getAttribute("from");
        var to = el.getAttribute("to");
        var direction = (from == this._con.getJid()) ? Message.OUTGOING : Message.INCOMING;
        var delivered = el.getElementsByTagName("received").length > 0;

        var message = new Message(id, from, to, direction, body, time, delivered);
        messages.push(message);
    }

    callback.call(scope, messages);
};

// ============================================================
// Shared classes
// ============================================================


/**
* Represents a chat message.
*
* @memberof carusto
* @alias carusto.Message
* @public
* @constructor
*/
function Message(id, from, to, direction, body, time, delivered) {
    this._id = id;
    this._from = from;
    this._to = to;
    this._direction = direction;
    this._body = body;
    this._time = time;
    this._delivered = delivered;
}

/**
 * Returns id of the message, or empty string if id has not been set.
 *
 * @returns {string}
 */
Message.prototype.getId = function() {
    return this._id;
};

/**
 * @returns {string}
 */
Message.prototype.getFrom = function() {
    return this._from;
};

/**
 * @returns {string}
 */
Message.prototype.getTo = function() {
    return this._to;
};

/**
* Returns body of the message.
*
* @returns {string}
*/
Message.prototype.getBody = function() {
   return this._body;
};

/**
 * Returns body of the message.
 *
 * @returns {string}
 */
Message.prototype.getHtmlBody = function() {
    // Process tags
    var str = this._body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Process anchors
    var rows = str.split('\n'); str = "";
    for (var n = 0; n < rows.length; n++) {
        var words = rows[n].split(/\s/g);
        for (var i = 0; i < words.length; i++) {
            var match = words[i].match(/^(http:\/\/|https:\/\/)/gi);
            if (match != null) {
                words[i] = words[i].replace(/"/g, '');
                str += ' ' + '<a href="' + words[i] + '" target="_blank">' + words[i] + '</a>';
            } else {
                str += ' ' + words[i];
            }
        }
        if (n != rows.length - 1) {
            str += '\n';
        }
    }

    // Process new lines
    str = str.replace(/^\s+/,'').replace(/  /g, '&nbsp;&nbsp;').replace(/\n/g, '<br/>');

    return str;
};

/**
* @returns {Date} A time when message were sent
*/
Message.prototype.getTime = function() {
   return this._time;
};

/**
 * @returns {boolean}
 */
Message.prototype.isIncoming = function() {
    return this._direction == Message.INCOMING;
};

/**
 * @returns {boolean}
 */
Message.prototype.isOutgoing = function() {
   return this._direction == Message.OUTGOING;
};

/**
 * @returns {boolean}
 */
Message.prototype.isDelivered = function() {
   return this._delivered;
};

Message.INCOMING = 1;

Message.OUTGOING = 2;

// ----

export {
    Conversations,
    Message
}
