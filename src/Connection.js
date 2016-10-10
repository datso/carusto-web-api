import EventEmitter from 'event-emitter-es6'
import SockJS from 'sockjs-client'
import {Stomp} from './libs/stomp'
import {Base64} from 'js-base64'

/**
 * Usage:
 *
 * var conn = new Connection("309180", "8qWAlyaS/kh8zwHPusM+jg==", "test", "http://192.168.50.146/xmpp/");
 * conn.connect();
 *
 * @constructor
 */
export class Connection extends EventEmitter {

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

    constructor(userLogin, userPassword, realm, host, options) {
        super();

        let auth = Base64.encode(userLogin + ":" + userPassword);

        this._userLogin = userLogin;
        this._userPassword = userPassword;
        this._realm = realm;
        this._host = host;
        this._options = options;

        this._reconTime = 0;
        this._reconTimeout = false;
        this._reconMin = 2;
        this._reconMax = 16;

        this._con = false;
        this._conId = false;
        this._conClient = false;
        this._conUrl = "http://" + host + ':8080/stomp?auth=' + auth; // TODO: Add proxy instead of 8080 port
        this._conReconnect = false;
        this._connected = false;
        this._connecting = false;

        // -----
        EventEmitter.call(this);

        // TODO: Define which plugins should be enabled.
        return this;
    }

    /**
     * Connects to a Carusto server throught SockJS.
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
    connect() {
        this._conReconnect = true;
        this._connect();
    }

    /**
     * @access public
     */
    reconnect() {
        if (this.isConnected()) {
            this.disconnect();
        }

        this._conReconnect = true;
        this._connect();
    }

    /**
     * @private
     */
    _connect() {
        this._conId++;
        this._conSocket = new SockJS(this._conUrl);

        console.log("this._conUrl", this._conUrl);

        this._conStompClient = Stomp.over(this._conSocket);
        this._conStompClient.connect("test", "fest", this._handleConnected.bind(this));
        this._connecting = true;
    }

    /**
     * Closes the connection to XMPP realm.
     *
     * @access public
     */
    disconnect() {
        this._connected = false;

        this._conReconnect = false;
        this._conSocket.close();
    }

    /**
     * Returns true if currently connected to the XMPP realm.
     *
     * @access public
     * @returns {boolean}
     */
    isConnected() {
        return this._connected;
    }

    /**
     * Returns STOMP client representing current connection to SockJS server.
     *
     * @access public
     * @returns {Stomp}
     */
    getStompClient() {
        return this._conStompClient;
    }

    // ============================================================
    // STOMP callbacks
    // ============================================================

    /**
     * @private
     * @event Connection#connected
     */
    _handleConnected() {
        this._connecting = false;
        this._connected = true;
        this.emit("connected", this);
    }

    /**
     * Fires when user has been disconnected (fired by jsjac connection object).
     *
     * @private
     * @event Connection#disconnected
     */
    _handleDisconnected() {
        this._connecting = false;
        this.emit("disconnected", "Unknown error");

        if (this._conReconnect) {
            let id = this._conId++;
            let delay = Math.floor(Math.random() * (this._reconMax - this._reconMin + 1)) + this._reconMax;

            setTimeout(() => {
                if (id === this._conId) {
                    this._connect();
                }
            }, delay);
        }
    }
}