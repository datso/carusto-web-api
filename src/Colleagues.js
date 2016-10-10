import EventEmitter from 'event-emitter-es6'
import {Person, PersonProperty} from './Contacts'

export class ColleaguesExtension extends EventEmitter {
    /**
     * Indicates that new colleague is available in system.
     *
     * @event ColleaguesExtension#colleague_create
     * @property {Colleague} colleague
     */

    /**
     * Indicates that colleague information was updated.
     *
     * @event ColleaguesExtension#colleague_update
     * @property {Colleague} colleague
     */

    /**
     * Indicates that colleague updated his avatar
     *
     * @event ColleaguesExtension#colleague_avatar_update
     * @property {Colleague} colleague
     */

    /**
     * Indicates that colleague was removed from system.
     *
     * @event ColleaguesExtension#colleague_delete
     * @property {Colleague} colleague
     */

    constructor(connection) {
        super();

        this._con = connection;

        this._groups = {};
        this._colleagues = [];
        this._colleagues_map = {};
        this._colleagues_lookups = [];

        // this._con.on("connect", this._onConnect.bind(this));

        // -----
        // this._con.pub.on("user_create", this._onColleagueCreated, this);
        // this._con.pub.on("user_change", this._onColleagueChanged, this);
        // this._con.pub.on("user_avatar_change", this._onColleagueAvatarChanged, this);
        // this._con.pub.on("user_delete", this._onColleagueDeleted, this);
    }

    _onConnect() {
        // TODO: Subscribe to "user.message.sent | user.message.delivered"
    }

    _onDisconnect() {
        // TODO: Cleanup state?
    }

    /**
     * Gets a list of contacts that in state.
     *
     * @public
     * @returns {Array}
     */
    getAvailableColleagues() {
        return this._colleagues;
    }

    /**
     * @public
     * @param id integer User id
     * @returns {Colleague|null}
     */
    getColleague(id) {
        return this._colleagues_map.hasOwnProperty(id) ? this._colleagues_map[id] : null;
    }

    /**
     * Lookup colleague in local cache and make request to server if local cache is empty.
     * @public
     * @returns {Promise}
     */
    lookupColleague(id) {
        // TODO: Implementation
        // if (this._colleagues_map[jid]) {
        //     callback.call(scope, this._colleagues_map[jid]);
        //     return;
        // }
        // this._colleagues_lookups.push({jid: jid, callback: callback, scope: scope});
    }

    /**
     * @public
     */
    retrieveColleagues = function() {
        this._retrieveColleagues();
    }

}

export class ColleagueGroup  {
    constructor (id, name) {
        this._id = id;
        this._name = name;
    }

    /**
     * @returns {String}
     */
    getId() {
        return this._id;
    }

    /**
     * @returns {String}
     */
    getName() {
        return this._name;
    }
}

export class Colleague extends Person {
    constructor(id, info, extension, group) {
        super(info);

        this._id = id;
        this._extension = extension;
        this._group = group;
    }

    getId() {

    }

    getExtension() {

    }

    getGroup() {

    }
}
