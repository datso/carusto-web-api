import Observable from './Observable';
import {JSJaCIQ, JSJaCMessage} from './jsjac';
import {createRestPacket, createRestHandler} from './Rest';
import {Colleague, Tel} from './Contacts'
import {text, nodeValue, color} from './Utils';
import {Message} from './Conversations'

var NS = "urn:carusto:conference";
var NS_USER = "urn:carusto:conference#user";
var NS_MODERATOR = "urn:carusto:conference#moderator";

/**
 * Constructor for Conferences.
 *
 * @public
 * @constructor
 */
function Conferences(connection) {
    this._con = connection;
    this._con.registerHandler("presence", this._handlePresence, this, 1);
    this._con.registerHandler("message", this._handleMessage, this, 1);
    this._con.addListener("disconnected", this._onDisconnected, this);

    this._conferences = [];
    this._conferences_map = {};
    this._conferences_presence_map = {};

    this._empty_presence = new ConferencePresence(false, null, "disconnected", null, false, false);

    // Initialize supper
    Observable.call(this);
}

Conferences.prototype = Object.create(Observable.prototype);

// ============================================================
// Public events
// ============================================================

/**
 * Indicates that new message is received from remote contact.
 *
 * @event Conferences#message_received
 * @property {Contact} contact
 * @property {Message} message
 */

/**
 * Indicates that message has been send to remote contact.
 *
 * @event Conferences#message_send
 * @property {Contact} contact
 * @property {Message} message
 */

/**
 * Indicates that remote contact reads message.
 *
 * @event Conferences#message_delivered
 * @property {Contact} contact
 * @property {Message} message
 */

// ============================================================
// Public functions
// ============================================================

/**
 *
 */
Conferences.prototype.create = function(subject, participants, options, callback, scope) {
    var packet = this._createConferenceElement(subject, participants, options);
    packet.setTo(this._getConferencesRealm());
    var handler = this._con._handleIQCallback(this._handleCreateConferenceResponse, this, [callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 * Sends a message to conference
 */
Conferences.prototype.send = function(conference, body) {
    var packet = new JSJaCMessage();
    packet.setTo(conference.getJid());
    packet.setType('chat');
    packet.setBody(text(body));

    this._con.send(packet);
};

/**
 *
 */
Conferences.prototype.kick = function(conference, participant, callback, scope) {
    var participants = [];
    var old = conference.getParticipants();

    for (var i=0; i < old.length; i++) {
        var o = old[i];

        if (participant.getId() != o.getId()) {
            if (o.getContact() instanceof Colleague) {
                if (o.getContact().getJid() == this._con.getJid()) {
                    continue;
                }
            }

            participants.push(old[i]);
        }
    }

    var packet = this._createConferenceElement(conference.getSubject(), participants, conference.getOptions());
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleChangeConferenceResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.invite = function(conference, participant, callback, scope) {
    var participants = [];
    var old = conference.getParticipants();

    for (var i=0; i < old.length; i++) {
        var o = old[i];
        if (o.getContact() instanceof Colleague && o.getContact().getJid() == this._con.getJid()) {
            continue;
        }

        participants.push(old[i]);
    }

    participants.push(participant);


    var packet = this._createConferenceElement(conference.getSubject(), participants, conference.getOptions());
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleChangeConferenceResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.rename = function(conference, subject, callback, scope) {
    var packet = this._createConferenceElement(subject, conference.getParticipants(), conference.getOptions());
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleChangeConferenceResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 * Originate to conference
 */
Conferences.prototype.originate = function(conference, registration, callback, scope) {
    var packet = this._createOriginateElement(conference, registration);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleActionResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.originateParticipants = function(conference, participants, callback, scope) {
    var packet = this._createOriginateParticipantsElement(conference, participants);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleActionResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.terminateParticipants = function(conference, participants, callback, scope) {
    var packet = this._createTerminateParticipantsElement(conference, participants);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleActionResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.mute = function(conference, participants, callback, scope) {
    var packet = this._createMuteElement(conference, participants);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleActionResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.unmute = function(conference, participants, callback, scope) {
    var packet = this._createUnmuteElement(conference, participants);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleActionResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.close = function(conference, callback, scope) {
    var packet = this._createConferenceCloseElement(conference);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleCloseResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 *
 */
Conferences.prototype.exit = function(conference, callback, scope) {
    var packet = this._createConferenceExitElement(conference);
    packet.setTo(conference.getJid());
    var handler = this._con._handleIQCallback(this._handleCreateExitResponse, this, [conference, callback, scope]);
    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Conferences.prototype.getByJid = function(jid) {
    for (var i=0; i < this._conferences.length; i++) {
        if (this._conferences[i].getJid() == jid) {
            return this._conferences[i];
        }
    }

    return null;
};

/**
 * @public
 */
Conferences.prototype.getById = function(id) {
    for (var i=0; i < this._conferences.length; i++) {
        if (this._conferences[i].getId() == id) {
            return this._conferences[i];
        }
    }

    return null;
};

/**
 *
 */
Conferences.prototype.getConferences = function() {
    return this._conferences.slice(0);
};

// ============================================================
// Conferences callbacks
// ============================================================

/**
 * @private
 */
Conferences.prototype._onDisconnected = function() {
    // Fire events
    for (var i=0; i < this._conferences.length; i++) {
        var conference = this._conferences[i];
        var participants = conference.getParticipants();

        for (var c=0; c < participants.length; c++) {
            var participant = participants[c];
            participant._presence = new ConferencePresence(false, "", false, false, false);

            this._fire("presence", conference, participant);
        }

        this._fire("close", conference, "disconnected");
    }

    this._conferences = [];
    this._conferences_map = {};
    this._conferences_presence_map = {};
}

/**
 * @private
 */
Conferences.prototype._handleMessage = function(packet) {
    var jid = packet.getFromJID().removeResource().toString();

    for (var i=0; i < this._conferences.length; i++) {
        if (this._conferences[i].getJid() == jid) {
            return this._handleConferenceMessage(packet, this._conferences[i]);
        }
    }


    return false;
}

/**
 * @private
 */
Conferences.prototype._handleConferenceMessage = function(packet, conference) {
    var type = packet.getType();
    var body = packet.getBody();
    var node = packet.getNode();

    if (!(type == "" || type == "chat" || type == "normal") || body.length == 0) {
        return false;
    }

    var id = node.getAttribute('id');
    var delay = node.getElementsByTagName("delay")[0];
    var time = new Date(delay.getAttribute("stamp"));
    var participant = conference.getParticipant(packet.getFromJID().getResource());
    var direction = Message.INCOMING;
    if (!participant) {
        direction = Message.OUTGOING;
    }

    var message = new ConferenceMessage(id, participant, direction, body, time);

    this._fire("message", conference, message);

    return true;
}

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
Conferences.prototype._handleMessageFallback = function(packet) {
    // ...
    // ...

    return false;
}

/**
 * @private
 */
Conferences.prototype._handlePresence = function(packet) {
    var node = packet.getNode();
    var els = node.getElementsByTagNameNS(NS, "x");
    if (els.length > 0) {
        return this._handleConferencePresence(packet.getFrom(), els.item(0));
    }

    var els = node.getElementsByTagNameNS(NS_USER, "x");
    if (els.length > 0) {
        return this._handleUserPresence(packet, els.item(0));
    }

    var els = node.getElementsByTagNameNS(NS_MODERATOR, "x");
    if (els.length > 0) {
        // console.log("getElementsByTagNameNS NS_MODERATOR", node);
        return true;
    }

    return false;
}

/**
 * Fires when conference has been changed.
 */
Conferences.prototype._handleConferencePresence = function(jid, x) {
    var conference = this._parseConferenceEl(jid, x);

    var invites = x.getElementsByTagName("invite");
    if (invites.length > 0) {
        return this._handleConferenceInvite(jid, x);
    }

    if (!this._conferences_map.hasOwnProperty(conference.getJid())) {
        this._conferences.push(conference);
        this._conferences_map[jid] = conference;
        this._conferences_presence_map[jid] = {};
        this._fire("available", conference);
    } else {
        var prev = this._conferences_map[conference.getJid()];
        prev._subject = conference._subject;
        prev._participants = conference._participants;
        prev._options = conference._options;

        this._fire("change", prev);
    }

    return true;
};

/**
 * Fires when conference has been changed.
 */
Conferences.prototype._handleConferenceInvite = function(jid, x) {
    if (this._conferences_map.hasOwnProperty(jid)) {
        this._fire("invite", this._conferences_map[jid]);
    }

    return true;
};

/**
 * Fires when presence of member or mine is changed in that conference.
 * When:
 * - member has change a presence
 * - current user has benn kicked
 */
Conferences.prototype._handleUserPresence = function(packet, x) {
    var conference = this._conferences_map[packet.getFromJID().removeResource().toString()];
    if (!conference) {
        return true;
    }

    var resource = packet.getFromJID().getResource();

    // Membership presence
    if (!resource) {
        // Personal conference persistance
        var status = packet.getStatus();
        var close = false;

        if (status == 'kicked' || status == 'exit' || status == 'end') {
            close = true;
        }

        if (close) {
            var index = this._conferences.indexOf(conference);

            this._conferences.splice(index, 1);
            delete this._conferences_map[conference.getJid()];

            var participants = conference.getParticipants();
            for (var c=0; c < participants.length; c++) {
                var participant = participants[c];
                participant._presence = new ConferencePresence(false, "", false, false, false);

                this._fire("presence", conference, participant);
            }

            this._fire("close", conference, status);
        }

        return true;
    }

    // Member presence
    var presence = this._parsePresenceEl(x);
    var participant = conference.getParticipant(packet.getFromJID().getResource());
    participant._presence = presence;

    this._conferences_presence_map[conference.getJid()][participant.getId()] = presence;
    this._fire("presence", conference, participant);

    return true;
};

Conferences.prototype._parseConferenceEl = function(conferenceJid, conferenceNode) {
    var presences = this._conferences_presence_map[conferenceJid];
    var conferenceExtension = conferenceJid.match(/\d+(?=@)/)[0];
    var subject = "unknown";
    var participants = [];

    // Parse options
    var options = {};
    var optionsEls = conferenceNode.getElementsByTagName("options");
    if (optionsEls.length > 0) {
        var optionsEl = optionsEls.item(0);
        var optionEls = optionsEl.getElementsByTagName("item");

        for (var i=0; i < optionEls.length; i++) {
            var el = optionEls[i];
            var name = el.getAttribute("name");
            var value = el.getAttribute("value");

            options[name] = value;
        }
    }
    // Parse subject
    var subjectEls = conferenceNode.getElementsByTagName("subject");
    if (subjectEls.length > 0) {
        subject = subjectEls.item(0).childNodes[0].nodeValue;
    }

    // Parse members
    var membersEls = conferenceNode.getElementsByTagName("members");
    if (membersEls.length > 0) {
        var membersEl = membersEls.item(0);
        var memberEls = membersEl.getElementsByTagName("item");

        for (var i=0; i < memberEls.length; i++) {
            var el = memberEls[i];
            var id = el.getAttribute("id");
            var role = el.getAttribute("role");
            var contact = null;

            var jidEls = el.getElementsByTagName("jid");
            var extensionEls = el.getElementsByTagName("extension");

            if (jidEls.length > 0) {
                var jid = jidEls.item(0).childNodes[0].nodeValue;

                contact = this._con.contacts.getColleague(jid);
                if (contact == null) {
                    var els = el.getElementsByTagName("colleague");
                    if (els.length > 0) {
                        var data = JSON.parse(nodeValue(els.item(0)));
                        contact = this._con.contacts.applyColleague(data);
                    }
                }
                if (contact == null) {
                    continue;
                }
            } else if (extensionEls.length > 0) {
                var extension = extensionEls.item(0).childNodes[0].nodeValue;
                contact = new Tel(extension);
            }

            var presence = this._empty_presence;
            if (presences && presences.hasOwnProperty(id)) {
                presence = presences[id];
            }

            participants.push(new ConferenceParticipant(id, contact, role, presence));
        }
    }

    return new Conference(conferenceJid, conferenceExtension, subject, participants, options);
};

Conferences.prototype._parsePresenceEl = function(el) {
    var show = null;
    var showEls = el.getElementsByTagName("show");
    if (showEls.length > 0) {
        show = showEls.item(0).childNodes[0].nodeValue;
    }

    var online = false;
    var onlineEls = el.getElementsByTagName("online");
    if (onlineEls.length > 0) {
        online = true;
    }

    var audioStatus = "disconnected";
    var audioEls = el.getElementsByTagName("audio");
    if (audioEls.length > 0) {
        audioStatus = audioEls.item(0).childNodes[0].nodeValue;
    }

    var audioMute = false;
    var audioMuteEls = el.getElementsByTagName("audio-mute");
    if (audioMuteEls.length > 0) {
        audioMute = true;
    }

    var speak = false;
    var speakEls = el.getElementsByTagName("speaking");
    if (speakEls.length > 0) {
        speak = true;
    }

    return new ConferencePresence(online, show, audioStatus, audioMute, speak);
};

// ============================================================
// Private functionality
// ============================================================

/**
 * Format XML:
 * <iq to="conference.localpbx" type="set">
 * <query xmlns="urn:carusto:conference">
 *    <subject>Modified conference name</subject>
 *    <members>
 *        <item id="qwerq1" role="participant" name="John Doe (106)">
 *            <jid>277135@localpbx</jid>
 *            <extension>106</extension>
 *        </item>
 *        <item id="123123" role="participant" name="John Doe (106)">
 *            <jid>202102@localpbx</jid>
 *            <extension>106</extension>
 *        </item>
 *        <item id="qwerq" role="participant" name="+380634664426">
 *            <extension>+380634664426</extension>
 *        </item>
 *    </members>
 * </query>
 * </iq>
 *
 * @private
 */
Conferences.prototype._createConferenceElement = function(subject, participants, options) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS);

    // Format subject
    var subj = packet.getDoc().createElement('subject');
    subj.appendChild(packet.getDoc().createTextNode(subject));
    query.appendChild(subj);

    // Format members (each )
    var parts = packet.getDoc().createElement('members');
    for (var i=0; i < participants.length; i++) {
        var participant = participants[i];
        var contact = participant.getContact();
        var el = packet.getDoc().createElement('item');
        el.setAttribute("id", participant.getId());
        el.setAttribute("role", "participant");

        if (contact instanceof Colleague) {
            var jid = packet.getDoc().createElement('jid');
            jid.appendChild(packet.getDoc().createTextNode(contact.getJid()));
            el.appendChild(jid);
        } else if (contact instanceof Tel) {
            var extension = packet.getDoc().createElement('extension');
            extension.appendChild(packet.getDoc().createTextNode(contact.getNumber()));
            el.appendChild(extension);
        }

        parts.appendChild(el);
    }
    query.appendChild(parts);

    return packet;
};

/**
 %% <query>
 %%     <originate>
 %%         <item id="XXXX" />
 %%         ...other participants...
 %%     </originate>
 %% </query>
 */
Conferences.prototype._createOriginateElement = function(conference, registration) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_MODERATOR);
    var originate = packet.getDoc().createElement('originate');
    originate.setAttribute('registration', registration.getId());
    query.appendChild(originate);

    return packet;
};

/**
 %% <query>
 %%     <originate>
 %%         <item id="XXXX" />
 %%         ...other participants...
 %%     </originate>
 %% </query>
 */
Conferences.prototype._createOriginateParticipantsElement = function(conference, participants) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_MODERATOR);
    var originate = packet.getDoc().createElement('originate-participants');

    this._createParticipantsElement(packet.getDoc(), originate, participants);
    query.appendChild(originate);

    return packet;
};

/**
 %% <query>
 %%     <mute>
 %%         <item id="XXXX" />
 %%         ...other participants...
 %%     </mute>
 %% </query>
 */
Conferences.prototype._createMuteElement = function(conference, participants) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_MODERATOR);
    var mute = packet.getDoc().createElement('mute');

    this._createParticipantsElement(packet.getDoc(), mute, participants);
    query.appendChild(mute);

    return packet;
};

/**
 %% <query>
 %%     <terminate-participants>
 %%         <item id="XXXX" />
 %%         ...other participants...
 %%     </terminate>
 %% </query>
 */
Conferences.prototype._createTerminateParticipantsElement = function(conference, participants) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_MODERATOR);
    var terminate = packet.getDoc().createElement('terminate-participants');

    this._createParticipantsElement(packet.getDoc(), terminate, participants);
    query.appendChild(terminate);

    return packet;
};

/**
 %% <query>
 %%     <unmute>
 %%         <item id="XXXX" />
 %%         ...other participants...
 %%     </unmute>
 %% </query>
 */
Conferences.prototype._createUnmuteElement = function(conference, participants) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_MODERATOR);
    var unmute = packet.getDoc().createElement('unmute');

    this._createParticipantsElement(packet.getDoc(), unmute, participants);
    query.appendChild(unmute);

    return packet;
};

/**
 * @private
 */
Conferences.prototype._createParticipantsElement = function(doc, target, participants) {
    for (var i=0; i < participants.length; i++) {
        var participant = participants[i];
        var el = doc.createElement('item');
        el.setAttribute("id", participant.getId());

        target.appendChild(el);
    }
};

/**
 %% <iq type="set" to="xxxx@xxxx">
 %%     <query xmlns="urn:carusto:conference#moderator">
 %%         <close />
 %%     </query>
 %% </iq>
 */
Conferences.prototype._createConferenceCloseElement = function(conference) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_MODERATOR);
    var close = packet.getDoc().createElement('close');
    query.appendChild(close);

    return packet;
};
/**
 %% <iq type="set" to="xxxx@xxxx">
 %%     <query xmlns="urn:carusto:conference#user">
 %%         <close />
 %%     </query>
 %% </iq>
 */
Conferences.prototype._createConferenceExitElement = function(conference) {
    var packet = new JSJaCIQ().setType('set');
    var query = packet.setQuery(NS_USER);
    var exit = packet.getDoc().createElement('exit');
    query.appendChild(exit);

    return packet;
};


/**
 * @private
 */
Conferences.prototype._handleCreateConferenceResponse = function(iq, callback, scope) {
    var node = iq.getNode();
    var jid = null;
    var conference = null;

    var queries = node.getElementsByTagName("query");
    if (queries.length > 0) {
        var query = queries.item(0);
        var els = query.getElementsByTagName("jid");
        if (els.length > 0) {
            jid = els.item(0).childNodes[0].nodeValue;
            conference = this._parseConferenceEl(jid, query);
        }
    }

    this._conferences.push(conference);
    this._conferences_map[jid] = conference;
    this._conferences_presence_map[jid] = {};

    callback.call(scope, conference);
}

Conferences.prototype._handleChangeConferenceResponse = function(iq, conference, callback, scope) {
    var jid = conference.getJid();

    var node = iq.getNode();
    var queries = node.getElementsByTagName("query");
    if (queries.length > 0) {
        var query = queries.item(0);
        var n = this._parseConferenceEl(jid, query);

        conference._subject = n._subject;
        conference._participants = n._participants;
        conference._options = n._options;
    }

    callback.call(scope, conference);
}

/**
 * @private
 */
Conferences.prototype._handleCloseResponse = function(iq, conference, callback, scope) {
    callback.call(scope, conference);
}

/**
 * @private
 */
Conferences.prototype._handleActionResponse = function(iq, conference, callback, scope) {
    callback.call(scope, conference);
}

/**
 * @private
 */
Conferences.prototype._handleCreateExitResponse = function(iq, conference, callback, scope) {
    var index = this._conferences.indexOf(conference);

    if (index != -1) {
        this._conferences.splice(index, 1);
        delete this._conferences_map[conference.getJid()];
    }

    callback.call(scope, conference);
}

Conferences.prototype._getConferencesRealm = function() {
    return "conference." + this._con.getRealm();
}

// ============================================================
// Shared classes
// ============================================================

function Conference(jid, extension, subject, participants, options) {
    var parts = jid.split("@");

    this._jid = jid;
    this._id = parts.length == 2 ? parts[0] : null;
    this._extension = extension;
    this._subject = subject;
    this._participants = participants;
    this._options = options;
}

Conference.prototype.getId = function() {
    return this._id;
};

Conference.prototype.getJid = function() {
    return this._jid;
};

Conference.prototype.getExtension = function() {
    return this._extension;
};

Conference.prototype.getSubject = function() {
    return this._subject;
};

Conference.prototype.getName = function() {
    return this._subject + ' <' + this._extension +'>';
};

Conference.prototype.getParticipant = function(id) {
    for (var i=0; i < this._participants.length; i++) {
        var p = this._participants[i];
        if (id == p.getId()) {
            return p;
        }
    }

    return null;
};

Conference.prototype.getParticipants = function() {
    return this._participants;
};

Conference.prototype.getParticipantByJid = function(jid) {
    for (var i=0; i < this._participants.length; i++) {
        var p = this._participants[i];
        if (jid == p.getContact().getJid()) {
            return p;
        }
    }

    return null;
};

Conference.prototype.getOptions = function() {
    return this._options;
};

Conference.prototype.getColor = function() {
    return color(this.getName());
};

/**
 * True when User can moderate Conference
 *
 * @returns {boolean}
 */
Conference.prototype.isModerator = function() {
    return this._options["role"] == "moderator";
};

/**
 * True when Conference strategy is moderator.
 *
 * @returns {boolean}
 */
Conference.prototype.isModeratorStrategy = function() {
    return this._options["strategy"] == "moderator";
};

function ConferenceParticipant(id, contact, role, presence) {
    if (!id) {
        id = (Math.floor(Math.random()*10000000)+1) + "";
    }

    this._id = id;
    this._contact = contact;
    this._role = role ? role : "participant"
    this._presence = presence;
}

ConferenceParticipant.prototype.getId = function() {
    return this._id;
};

ConferenceParticipant.prototype.getContact = function() {
    return this._contact;
};

ConferenceParticipant.prototype.getRole = function() {
    return this._role;
};

ConferenceParticipant.prototype.isModerator = function() {
    return this._role == 'moderator';
};

ConferenceParticipant.prototype.getPresence = function() {
    return this._presence;
};

function ConferencePresence(online, show, audioStatus, muted, speak) {
    this._show = show;
    this._online = online;
    this._audioStatus = audioStatus;
    this._audioMuted = muted;
    this._speaking = speak;
}

ConferencePresence.prototype.getStatusClasses = function() {
    var cls = [];
    if (this.isOnline()) {
        cls.push("online");
    }
    if (this.isAway()) {
        cls.push("away");
    }
    if (this.isDND()) {
        cls.push("dnd");
    }
    if (this.isAudioSpeaking()) {
        cls.push("audio-speaking");
    }
    if (this.isAudioInvited()) {
        cls.push("audio-invited");
    } else if (this.isAudioMuted()) {
        cls.push("audio-muted");
    }
    if (this.isAudioConnected()) {
        cls.push("audio-connected");
    }
    return cls.join(" ");
};

ConferencePresence.prototype.isOnline = function() {
    return this._online;
};

ConferencePresence.prototype.isAway = function() {
    return this._show == "away";
};

ConferencePresence.prototype.isDND = function() {
    return this._show == "dnd";
};

ConferencePresence.prototype.isAudioInvited = function() {
    return this._audioStatus == 'invited';
};

ConferencePresence.prototype.isAudioConnected = function() {
    return this._audioStatus == 'connected' || this._audioStatus == 'muted';
};

/**
 * @returns {boolean}
 */
ConferencePresence.prototype.isAudioMuted = function() {
    return this._audioMuted == true;
};

/**
 * @returns {boolean}
 */
ConferencePresence.prototype.isAudioSpeaking = function() {
    return this._speaking == true;
};

function ConferenceMessage(id, participant, direction, body, time) {
    this._id = id;
    this._participant = participant;
    this._direction = direction;
    this._body = body;
    this._time = time;
}

ConferenceMessage.prototype = Object.create(Message.prototype);

/**
 * @returns {string}
 */
ConferenceMessage.prototype.getFrom = function() {
    return null;
};

/**
 * @returns {string}
 */
ConferenceMessage.prototype.getTo = function() {
    return null;
};

/**
 * @returns {string}
 */
ConferenceMessage.prototype.getParticipant = function() {
    return this._participant;
};

/**
 * @returns {boolean}
 */
ConferenceMessage.prototype.isDelivered = function() {
    return true;
};

export {
    Conferences,
    Conference,
    ConferencePresence,
    ConferenceParticipant,
    ConferenceMessage
}