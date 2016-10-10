import EventEmitter from 'event-emitter-es6'

/**
 * Conversations plugin allows to chat with colleagues or participate in conferences.
 */
export class ConversationsPlugin extends EventEmitter {

    /**
     * Indicates that new message is received from remote contact.
     *
     * @event ConversationsPlugin#message_received
     * @property {Colleague} colleague
     * @property {Message} message
     */

    /**
     * Indicates that message has been send to remote contact.
     *
     * @event ConversationsPlugin#message_send
     * @property {Colleague} colleague
     * @property {Message} message
     */

    /**
     * Indicates that remote contact reads message.
     *
     * @event ConversationsPlugin#message_delivered
     * @property {Colleague} colleague
     * @property {Message} message
     */

    constructor(connection) {
        super();

        this._con = connection;
        this._con.on("connect", this._onConnect.bind(this));
    }

    _onConnect() {
        // TODO: Subscribe to "user.message.sent | user.message.delivered"
    }

    _onDisconnect() {
        // TODO: Cleanup state?
    }

    /**
     * Sends a message to user.
     *
     * @param {Contact} contact
     * @param {string} body
     */
    send(contact, body) {
        
        var packet = new JSJaCMessage();
        packet.setTo(contact.getJid());
        packet.setType('chat');
        packet.setBody(carusto.text(body));

        this._con.send(packet);
    }

    /**
     * Sends a notification that message are read by user.
     *
     * @param {Contact} contact A user that send message
     * @param {Message} message
     */
    sendDeliveryConfirmation(contact, message) {
        var packet = new JSJaCMessage();
        packet.setTo(contact.getJid());
        packet.setType('chat');
        packet.appendNode('received', {'xmlns': 'urn:xmpp:receipts', 'id': message.getId()});

        this._con.send(packet);
    }

    /**
     * @private
     */
    _handleMessage(packet) {
        console.log("_handleMessageDelivery", arguments);
    }

    /**
     * @private
     */
    _handleMessageDelivery() {
        console.log("_handleMessageDelivery", arguments);
    }

}

export const INCOMING = 1;

export const OUTGOING = 2;

/**
 * Represents a chat message.
 */
export class Message {

    constructor(id, from, to, direction, body, time, delivered) {
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
    getId() {
        return this._id;
    }

    /**
     * @returns {string}
     */
    getFrom() {
        return this._from;
    }

    /**
     * @returns {string}
     */
    getTo() {
        return this._to;
    }

    /**
     * Returns body of the message.
     *
     * @returns {string}
     */
    getBody() {
        return this._body;
    }

    /**
     * Returns body of the message.
     *
     * @returns {string}
     */
    getHtmlBody() {
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
    }

    /**
     * @returns {Date} A time when message were sent
     */
    getTime() {
        return this._time;
    }

    /**
     * @returns {boolean}
     */
    isIncoming() {
        return this._direction == INCOMING;
    }

    /**
     * @returns {boolean}
     */
    isOutgoing() {
        return this._direction == OUTGOING;
    }

    /**
     * @returns {boolean}
     */
    isDelivered() {
        return this._delivered;
    }
}
