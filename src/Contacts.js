import Observable from './Observable';
import {createRestPacket, createRestHandler} from './Rest';
import {color} from './Utils';

function Contacts(connection) {
    this._con = connection;
    this._groups = {};
    this._colleagues = [];
    this._colleagues_map = {};
    this._colleagues_lookups = [];

    // -----
    this._con.addListener("connected", this._onConnected, this);
    this._con.addListener("disconnected", this._onDisconnected, this);

    // -----
    this._con.pub.on("user_create", this._onColleagueCreated, this);
    this._con.pub.on("user_change", this._onColleagueChanged, this);
    this._con.pub.on("user_avatar_change", this._onColleagueAvatarChanged, this);
    this._con.pub.on("user_delete", this._onColleagueDeleted, this);

    // Initialize supper
    Observable.call(this);
};

Contacts.prototype = Object.create(Observable.prototype);

// ============================================================
// Public functions
// ============================================================

/**
 * Gets a list of contacts that in state.
 *
 * @public
 * @returns {Array}
 */
Contacts.prototype.getAvailableColleagues = function() {
    return this._colleagues.slice(0);
};

/**
 * @public
 * @param {string} jid A JID without a resource
 */
Contacts.prototype.getColleague = function(jid) {
    var contact = this._colleagues_map[jid];
    return contact ? contact : null;
};

/**
 * @public
 */
Contacts.prototype.getColleagueById = function(id) {
    for (var i=0; i < this._colleagues.length; i++) {
        if (this._colleagues[i].getId() == id) {
            return this._colleagues[i];
        }
    }

    return null;
};

/**
 * @public
 */
Contacts.prototype.applyColleague = function(data) {
    var colleague = Colleague.fromObject(data, this._con);
    var jid = colleague.getJid();

    this._colleagues_map[jid] = colleague;

    return colleague;
};

/**
 * Search for a specified contact on the server.
 *
 * @public
 */
Contacts.prototype.lookupColleague = function(jid, callback, scope) {
    if (this._colleagues_map[jid]) {
        callback.call(scope, this._colleagues_map[jid]);
        return;
    }

    this._colleagues_lookups.push({jid: jid, callback: callback, scope: scope});
};

/**
 * @public
 */
Contacts.prototype.retrieveColleague = function(jid, callback, scope) {
    var contact = this.getColleague(jid);
    if (!contact) {
        return this.lookupColleague(jid, callback, scope);
    }

    callback.call(scope, contact);
};

/**
 * @public
 */
Contacts.prototype.reloadColleagues = function() {
    this._retrieveColleagues();
};

/**
 * Add/remove contact to Favorites
 *
 * @param {carusto.Contact} contact
 * @param {boolean} favorite
 */
Contacts.prototype.setFavorite = function(contact, favorite) {
    if (favorite && this.favoritesAddCallback) {
        this.favoritesAddCallback.call(this.favoritesScope, contact);
    } else if (!favorite && this.favoritesRemoveCallback) {
        this.favoritesRemoveCallback.call(this.favoritesScope, contact);
    }

    contact._favorite = favorite;
};

/**
 * Set callbacks for Favorites
 *
 * @param {Function} requestCallback
 * @param {Function} addCallback
 * @param {Function} removeCallback
 * @param {Object} scope
 */
Contacts.prototype.setFavoriteCallbacks = function(requestCallback, addCallback, removeCallback, scope) {
    this.favoritesRequestCallback = requestCallback;
    this.favoritesAddCallback = addCallback;
    this.favoritesRemoveCallback = removeCallback;
    this.favoritesScope = scope;
};


// ============================================================
// Contacts functionality
// ============================================================

// colleagues groups functionality (begin)
Contacts.prototype.retrieveGroups = function(callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("GET", "/api/contacts/groups");
    var handler = createRestHandler(
        this._onGroupsResponse.bind(this, callback, scope), this,
        errorCallback, errorScope
    );

    this._con.sendIQ(packet, handler);
};

Contacts.prototype._onGroupsResponse = function(callback, scope, data) {
    var result = [],
        key;

    // reset groups list
    for (key in this._groups) {
        if (this._groups.hasOwnProperty(key)) {
            delete this._groups[key];
        }
    }

    for (key in data) {
        if (data.hasOwnProperty(key)) {
            var group = new Group(key, data[key]);

            result.push(group);
            this._groups[key] = group;
        }
    }

    callback.call(scope, result);
};
// colleagues groups functionality (begin)



// folders of contacts functionality (begin)
Contacts.prototype.retrieveFolders = function(callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("GET", "/api/contacts/folders");
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Contacts.prototype.retrieveFolder = function(id, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("GET", "/api/contacts/folders/" + id);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Contacts.prototype.createFolder = function(name, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("POST", "/api/contacts/folders", [{name: 'name', value: name}]);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Contacts.prototype.renameFolder = function(id, name, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("PUT", "/api/contacts/folders/" + id, [{name: 'name', value: name}]);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Contacts.prototype.shareFolder = function(id, participants, callback, scope, errorCallback, errorScope) {
    var params = [];

    for (var i = 0, length = participants.length; i < length; i++) {
        params.push({
            name: 'access',
            value: JSON.stringify(participants[i])
        });
    }

    var packet = createRestPacket("POST", "/api/contacts/folders/" + id + '/share', params);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Contacts.prototype.removeFolder = function(id, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("DELETE", "/api/contacts/folders/" + id);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};
// folders of contacts functionality (end)

/**
 * Filter for contacts
 *
 * @public
 */
Contacts.prototype.filter = function(filter, callback, scope, errorCallback, errorScope) {
    var params = [];

    if (filter.hasOwnProperty("folder")) {
        params.push({name: "folder", value: filter['folder']});
    }
    if (filter.hasOwnProperty("tag")) {
        params.push({name: "tag", value: filter['tag']});
    }
    if (filter.hasOwnProperty("query")) {
        params.push({name: "query", value: filter['query']});
    }
    if (filter.hasOwnProperty("query") && filter.hasOwnProperty("query_field")) {
        params.push({name: "query_field", value: filter['query_field']});
    }
    if (filter.hasOwnProperty("limit")) {
        params.push({name: "limit", value: filter['limit']});
    }
    if (filter.hasOwnProperty("limit") && filter.hasOwnProperty("offset")) {
        params.push({name: "offset", value: filter['offset']});
    }
    if (filter.hasOwnProperty("order")) {
        params.push({name: "order", value: filter['order']});
    }
    if (filter.hasOwnProperty("direction")) {
        params.push({name: "direction", value: filter['direction']});
    }

    var proxy = function(result) {
        var total = result.total;
        var contacts = [];

        for (var i=0; i < result.contacts.length; i++) {
            contacts.push(Contact.fromObject(result.contacts[i]));
        }

        callback.call(scope, {
            total: total,
            contacts: contacts
        });
    };

    var packet = createRestPacket("GET", '/api/contacts/', params);
    var handler = createRestHandler(proxy, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

/**
 * @public
 */
Contacts.prototype.retrieve = function(id, callback, scope, errorCallback, errorScope) {
    var proxy = function(result) {
        callback.call(scope, Contact.fromObject(result));
    };

    var packet = createRestPacket("GET", '/api/contacts/' + id, []);
    var handler = createRestHandler(proxy, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

/**
 * @public
 * @param {String} id The id of contacts' folder
 * @param {ContactProperty[]} info
 * @param callback
 * @param scope
 * @param errorCallback
 * @param errorScope
 */
Contacts.prototype.add = function(id, info, callback, scope, errorCallback, errorScope) {
    var params = [];

    params.push({name: "folder", value: id});

    for (var i=0; i < info.length; i++) {
        var property = info[i];
        var value = property instanceof ContactProperty ? property.stringify() : JSON.stringify(property);

        params.push({name: "info", value: value});
    }

    var proxy = function(result) {
        callback.call(scope, Contact.fromObject(result));
    };

    var packet = createRestPacket("POST", "/api/contacts/", params);
    var handler = createRestHandler(proxy, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

/**
 * @public
 * @param {Contact} contact
 * @param {ContactProperty[]} info
 * @param callback
 * @param scope
 * @param errorCallback
 * @param errorScope
 */
Contacts.prototype.change = function(contact, info, folder, callback, scope, errorCallback, errorScope) {
    var params = [];

    for (var i=0; i < info.length; i++) {
        var property = info[i];
        var value = property instanceof ContactProperty ? property.stringify() : JSON.stringify(property);

        params.push({name: "info", value: value});
    }

    params.push({name: "folder", value: folder.getId()});

    var proxy = function(result) {
        callback.call(scope, Contact.fromObject(result));
    };

    var packet = createRestPacket("PUT", "/api/contacts/" + contact.getId(), params);
    var handler = createRestHandler(proxy, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

/**
 * @public
 * @param {String} id The id of contacts' folder
 * @param {Contact/Contact[]} contacts
 * @param callback
 * @param scope
 * @param errorCallback
 * @param errorScope
 */
Contacts.prototype.move = function(id, contacts, callback, scope, errorCallback, errorScope) {
    var params = [];

    if (!Array.isArray(contacts)) {
        contacts = [contacts];
    }

    for (var i = 0, length = contacts.length; i < length; i++) {
        var contact = contacts[i];

        params.push({name: "id", value: contact.getId()});
    }

    params.push({name: "to", value: id});

    var packet = createRestPacket("PUT", '/api/contacts/move', params);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

/**
 * @public
 * @param {Contact/Contact[]} contacts
 * @param callback
 * @param scope
 * @param errorCallback
 * @param errorScope
 */
Contacts.prototype.remove = function(contacts, callback, scope, errorCallback, errorScope) {
    var params = [];

    if (!Array.isArray(contacts)) {
        contacts = [contacts];
    }

    for (var i = 0, length = contacts.length; i < length; i++) {
        var contact = contacts[i];

        params.push({name: "id", value: contact.getId()});
    }

    var packet = createRestPacket("DELETE", "/api/contacts", params, 60);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

// ============================================================
// Private functions
// ============================================================

/**
 * @private
 */
Contacts.prototype._onConnected = function() {
    this._retrieveColleagues();
};

/**
 * @private
 */
Contacts.prototype._onDisconnected = function() {
    // Nothings
};

/**
 * @private
 */
Contacts.prototype._retrieveColleagues = function() {
    var packet = createRestPacket("GET", "/api/me/colleagues");
    var handler = createRestHandler(this._onColleaguesResponse, this, this._onColleaguesResponseFailed, this);

    this._con.sendIQ(packet, handler);
};

/**
 * @private
 */
Contacts.prototype._onColleaguesResponse = function(items) {
    this._colleagues = [];
    this._colleagues_map = {};

    // -----
    for (var i=0; i < items.length; i++) {
        var colleague = Colleague.fromObject(items[i], this._con);
        var jid = colleague.getJid();

        this._colleagues.push(colleague);
        this._colleagues_map[jid] = colleague;
    }

    // -----
    var lookups = this._colleagues_lookups;
    for (var i=0; i < lookups.length; i++) {
        var jid = lookups[i]['jid'];
        var callback = lookups[i]['callback'];
        var scope = lookups[i]['scope'];

        if (this._colleagues_map[jid]) {
            callback.call(scope, this._colleagues_map[jid]);
        }
    }

    this._colleagues_lookups = [];

    // -----
    this._fire("colleagues", this._colleagues);
};

Contacts.prototype._onColleaguesResponseFailed = function(message) {
    this._fire("colleagues_failed", message);
};

/**
 * @private
 */
Contacts.prototype._onColleagueCreated = function(data) {
    var colleague = Colleague.fromObject(data, this._con);
    var jid = colleague.getJid();

    this._colleagues.push(colleague);
    this._colleagues_map[jid] = colleague;

    this._fire("colleague_create", colleague);
};

/**
 * @private
 */
Contacts.prototype._onColleagueChanged = function(data) {
    var colleague = Colleague.fromObject(data, this._con);
    var jid = colleague.getJid();
    var current = this._colleagues_map[jid];

    if (current) {
        current.update(colleague);

        this._fire("colleague_update", colleague);
    }
};

/**
 * @private
 */
Contacts.prototype._onColleagueAvatarChanged = function(id) {
    var colleague = this.getColleagueById(id);
    if (colleague) {
        this._fire("colleague_avatar_update", colleague);
    }
};

/**
 * @private
 */
Contacts.prototype._onColleagueDeleted = function(id) {
    var index = -1;
    var target = null;
    for (var i=0; i < this._colleagues.length; i++) {
        var colleague = this._colleagues[i];
        if (colleague.getId() == id) {
            target = colleague;
            index = i;
        }
    }

    if (index > -1) {
        this._colleagues.splice(index, 1);
        delete this._colleagues_map[target.getJid()];
    }

    if (target) {
        this._fire("colleague_delete", target);
    }
};

// ============================================================
// Shared classes
// ============================================================

// --------------------
// Represent a Telephone number of someone
// --------------------

function Tel(number, type) {
    this._number = number;
    this._type = type || "number";
}

Tel.prototype.getNumber = function() {
    return this._number;
};

Tel.prototype.getExtension = function() {
    return this.getNumber();
};

Tel.prototype.getName = function() {
    return this.getNumber();
};

Tel.prototype.getType = function() {
    return this._type;
};

Tel.prototype.getFormattedName = function() {
    return this.getNumber();
};

Tel.prototype.getEscapedFormattedName = function() {
    return this.getNumber();
};

Tel.prototype.getSid = function() {
    if (this._number) {
        return "id-" + this._number + "_" + this._type;
    }

    if (!this._sid) {
        this._sid = Contact._seq++;
    }

    return "seq-" + this._sid;
};

/**
 * @returns {String}
 */
Tel.prototype.getColor = function() {
    return color(this._number);
};

// --------------------
// Represent a Contact tag that exist in system
// --------------------

function Tag(name) {
    this._name = name;
}

Tag.prototype.getName = function() {
    return this._name;
};

Tag.prototype.getColor = function() {
    return color(this._name);
};

// --------------------
// Represent a Contact that exist in system
// --------------------

function ContactProperty(key, type, value) {
    this._key = key;
    this._type = type;
    this._value = value;
}

ContactProperty.prototype.getKey = function() {
    return this._key;
};

ContactProperty.prototype.getType = function() {
    return this._type;
};

ContactProperty.prototype.getValue = function() {
    return this._value;
};

ContactProperty.prototype.stringify = function() {
    return JSON.stringify({
        key: this._key,
        type: this._type,
        value: this._value
    });
};

ContactProperty.fromObject = function(obj) {
    return new ContactProperty(obj['key'], obj['type'], obj['value']);
};

// --------------------

function Contact(id, info, tags, folderId) {
    this._id = id;
    this._info = info;
    this._tags = tags;
    this._folderId = folderId || null;
}

Contact._seq = 0;

Contact.fromObject = function(obj) {
    var id = obj['id'];
    var info = obj['info'];
    var tags = obj['tags'];
    var folderId = null;

    if (obj.hasOwnProperty('folder_id')) {
        folderId = obj['folder_id'];
    } else if (obj.hasOwnProperty('folderId')) {
        folderId = obj['folderId'];
    }

    if (info) {
        for (var i=0; i < info.length; i++) {
            info[i] = ContactProperty.fromObject(info[i]);
        }
    } else {
        info = [];
    }

    if (tags) {
        for (var i=0; i < tags.length; i++) {
            tags[i] = new Tag(tags[i]);
        }
    } else {
        tags = [];
    }

    return new Contact(id, info, tags, folderId);
};

Contact.prototype.getSid = function() {
    if (this._id) {
        return "id-" + this._id;
    }

    if (!this._sid) {
        this._sid = Contact._seq++;
    }

    return "seq-" + this._sid;
};

/**
 * @returns {String}
 */
Contact.prototype.getType = function() {
    return "regular";
};

/**
 * @returns {int}
 */
Contact.prototype.getId = function() {
    return this._id;
};

/**
 * @returns {int}
 */
Contact.prototype.getFolderId = function() {
    return this._folderId;
};

/**
 * Iterate over all properties and return a first one for Provided key.
 *
 * @param {String} key
 * @returns {ContactProperty|null}
 */
Contact.prototype.getProperty = function(key) {
    for (var i=0; i < this._info.length; i++) {
        var prop = this._info[i];

        if (prop.getKey() == key) {
            return prop;
        }
    }

    return null;
};

/**
 * Iterate over all properties and return a first one for Provided key.
 *
 * @param {String} key
 * @returns {ContactProperty|null}
 */
Contact.prototype.getPropertyValue = function(key) {
    var property = this.getProperty(key);

    if (property) {
        return property.getValue();
    }

    return null;
};

/**
 * Iterate over all properties and return that has Provided key.
 *
 * @param {String} key
 * @returns {ContactProperty[]}
 */
Contact.prototype.getProperties = function(key) {
    var result = [];
    for (var i=0; i < this._info.length; i++) {
        var prop = this._info[i];

        if (prop.getKey() == key) {
            result.push(prop);
        }
    }

    return result;
};

/**
 * Iterate over all properties and return concatenated String.
 *
 * @param {String} key
 * @returns {String}
 */
Contact.prototype.getPropertiesValue = function(key) {
    var result = [];
    for (var i=0; i < this._info.length; i++) {
        var prop = this._info[i];

        if (prop.getKey() == key) {
            result.push(prop.getValue());
        }
    }

    return result.join(", ");
};

/**
 * @returns {ContactProperty[]}
 */
Contact.prototype.getInfo = function() {
    return this._info;
};

/**
 * @returns {Tag[]}
 */
Contact.prototype.getTags = function() {
    return this._tags;
};

/**
 * @returns {String[]}
 */
Contact.prototype.getInfoValues = function() {
    var prop;
    var values = [];

    var fn = this.getPropertiesValue("FN");
    var tel = this.getPropertiesValue("TEL");
    var email = this.getPropertiesValue("EMAIL");

    if (fn) {
        values.push(fn);
    }
    if (tel) {
        values.push(tel);
    }
    if (email) {
        values.push(email);
    }

    // Regular info
    var regular = [];

    for (var i=0; i < this._info.length; i++) {
        prop = this._info[i];

        if (prop.getKey() != 'FN' && prop.getKey() != 'TEL' && prop.getKey() != 'EMAIL' && prop.getKey() != 'CUSTOM') {
            regular.push(prop);
        }
    }

    regular.sort(function(a,b) {
        var x = a.getKey().toLowerCase();
        var y = b.getKey().toLowerCase();
        return x < y ? -1 : x > y ? 1 : 0;
    });

    for (var r=0; r < regular.length; r++) {
        values.push(regular[r].getValue());
    }

    // Custom info
    var custom = this.getProperties("CUSTOM");
    custom.sort(function(a,b) {
        var x = a.getType() ? a.getType().toLowerCase() : "";
        var y = b.getType() ? b.getType().toLowerCase() : "";
        return x < y ? -1 : x > y ? 1 : 0;
    });

    for (var c=0; c < custom.length; c++) {
        prop = custom[c];

        if (prop.getType()) {
            values.push(prop.getType() + ": " + prop.getValue());
        } else {
            values.push(prop.getValue());
        }
    }

    return values;
};

/**
 * @returns {String}
 */
Contact.prototype.getFormattedName = function() {
    var fn = this.getPropertyValue("FN");
    var tel = this.getPropertiesValue("TEL");

    if (fn && tel) {
        return fn + " <"+ tel +">";
    }
    if (fn) {
        return fn;
    }
    if (tel) {
        return tel;
    }

    if (this._info.length > 0) {
        var prop = this._info[0];
        return prop.getValue();
    }

    return "Contact #" + this.getSid();
};

/**
 * @returns {String}
 */
Contact.prototype.getAbbr = function() {
    var str = this.getFormattedName();
    if (str) {
        var parts = str.replace(/\s\s+/g, ' ').split(" ");

        if (parts.length > 1 && parts[0].length > 0 && parts[1].length > 0) {
            var first = parts[0][0].toUpperCase();
            var second = parts[1][0].toUpperCase();
            return first + '' + second;
        } else if (parts.length == 1 && parts[0].length > 1) {
            return parts[0].substr(0, 2).toUpperCase();
        }
    }

    return "";
};

/**
 * @returns {String}
 */
Contact.prototype.getEscapedFormattedName = function() {
    return this.getFormattedName();
};

/**
 * @returns {String}
 */
Contact.prototype.getAvatarURL = function() {
    return "/avatars/default/";
};

/**
 * @returns {String}
 */
Contact.prototype.getSmallAvatarURL = function() {
    return "/avatars/default/small/";
};

/**
 * @returns {String}
 */
Contact.prototype.getMediumAvatarURL = function() {
    return "/avatars/default/medium/";
};

/**
 * @returns {String}
 */
Contact.prototype.getLargeAvatarURL = function() {
    return "/avatars/default/large/";
};

/**
 * @returns {String}
 */
Contact.prototype.getColor = function() {
    return color(this.getFormattedName());
};

/**
 * @returns {String}
 */
Contact.prototype.getDescription = function() {
    var name = null;
    var number = null;

    var prop = this.getProperty("FN");
    if (prop) {
        name = prop.getValue();
    }

    var props = this.getProperties("TEL");
    if (props.length > 0) {
        var values = [];
        for (var i=0; i < props.length; i++) {
            values.push(props[i].getValue());
        }

        number = values.join(", ");
    }

    if (name && number) {
        return name + " <"+ number +">";
    } else if (name) {
        return name;
    } else if (number) {
        return number;
    } else {
        var params = this._info;
        var result = [];
        if (params.length > 0) {
            for (var c=0; c < params.length; c++) {
                result.push(params[c].getValue());
            }
        }

        return result.join("; ");
    }
};

// --------------------
// Regular contact
// --------------------

function Colleague(id, info, jid, extension, name, groupId, groupName, connection) {
    this._id = id;
    this._info = info;
    this._jid = jid;
    this._extension = extension;
    this._name = name;
    this._groupId = groupId;
    this._groupName = groupName;
    this._connection = connection;
}

Colleague.prototype = Object.create(Contact.prototype);

/**
 * @returns {Colleague}
 */
Colleague.fromObject = function(obj, connection) {
    var id = obj['id'];
    var info = obj['info'];
    var jid = obj['jid'];
    var extension = obj['extension'];
    var name = obj['name'];
    var groupId = obj['group_id'];
    var groupName = obj['group_name'];

    for (var i=0; i < info.length; i++) {
        info[i] = ContactProperty.fromObject(info[i]);
    }

    return new Colleague(id, info, jid, extension, name, groupId, groupName, connection);
};

/**
 * @returns {String}
 */
Colleague.prototype.update = function(colleague) {
    this._id = colleague._id;
    this._info = colleague._info;
    this._jid = colleague._jid;
    this._extension = colleague._extension;
    this._name = colleague._name;
    this._groupId = colleague._groupId;
    this._groupName = colleague._groupName;
};

/**
 * @returns {String}
 */
Colleague.prototype.getJid = function() {
    return this._jid;
};

/**
 * @returns {String}
 */
Colleague.prototype.getExtension = function() {
    return this._extension;
};

/**
 * @returns {String}
 */
Colleague.prototype.getName = function() {
    return this._name;
};

/**
 * @returns {int}
 */
Colleague.prototype.getGroupId = function() {
    return this._groupId;
};

/**
 * @returns {String}
 */
Colleague.prototype.getGroupName = function() {
    return this._groupName;
};

/**
 * @returns {Presence}
 */
Colleague.prototype.getPresence = function() {
    // Proxy
    return this._connection.presences.get(this);
};

/**
 * @returns {String}
 */
Colleague.prototype.getFormattedName = function() {
    return this._name + " <"+ this._extension +">";
};

/**
 * @returns {String}
 */
Colleague.prototype.getEscapedFormattedName = function() {
    return this._name + " &lt;"+ this._extension +"&gt;";
};

/**
 * @returns {String}
 */
Colleague.prototype.getAvatarURL = function() {
    return "/avatars/" + this._uid + "/";
};

/**
 * @returns {String}
 */
Colleague.prototype.getSmallAvatarURL = function() {
    return "/avatars/" + this._uid + "/small/";
};

/**
 * @returns {String}
 */
Colleague.prototype.getMediumAvatarURL = function() {
    return "/avatars/" + this._uid + "/medium/";
};

/**
 * @returns {String}
 */
Colleague.prototype.getLargeAvatarURL = function() {
    return "/avatars/" + this._uid + "/large/";
};


// --------------------
// Group of colleagues
// --------------------

function Group(id, name) {
    this._id = id;
    this._name = name;
}

/**
 * @returns {String}
 */
Group.prototype.getId = function() {
    return this._id;
};

/**
 * @returns {String}
 */
Group.prototype.getName = function() {
    return this._name;
};

// --------------------
// Folder of contacts
// --------------------

function FolderParticipant(id, name, access, type) {
    this._id = id;
    this._name = name;
    this._access = access;
    this._type = type;
}

/**
 * @returns {FolderParticipant}
 */
FolderParticipant.fromObject = function(obj) {
    var id = obj['id'];
    var name = obj['name'];
    var access = obj['access'];
    var type = obj['type'];

    return new FolderParticipant(id, name, access, type);
};

/**
 * @returns {String}
 */
FolderParticipant.prototype.getId = function() {
    return this._id;
};

/**
 * @returns {String}
 */
FolderParticipant.prototype.getName = function() {
    return this._name;
};

/**
 * @returns {String}
 */
FolderParticipant.prototype.getAccess = function() {
    return this._access;
};

/**
 * @returns {String}
 */
FolderParticipant.prototype.getType = function() {
    return this._type;
};


function Folder(id, name, owner, access, participants) {
    this._id = id;
    this._name = name;
    this._owner = owner;
    this._access = access;
    this._participants = participants;
}

/**
 * @returns {Folder}
 */
Folder.fromObject = function(obj) {
    var id = obj['id'];
    var name = obj['name'];
    var owner = obj['owner'];
    var access = obj['access'];
    var participants = obj['participants'];

    for (var i=0; i < participants.length; i++) {
        participants[i] = FolderParticipant.fromObject(participants[i]);
    }

    return new Folder(id, name, owner, access, participants);
};

/**
 * @returns {String}
 */
Folder.prototype.getId = function() {
    return this._id;
};

/**
 * @returns {String}
 */
Folder.prototype.getName = function() {
    return this._name;
};

/**
 * @returns {String}
 */
Folder.prototype.getOwner = function() {
    return this._owner;
};

/**
 * @returns {String}
 */
Folder.prototype.getAccess = function() {
    return this._access;
};

/**
 * @returns boolean
 */
Folder.prototype.isWriteAllowed = function() {
    return this._access == 'WRITE';
};

/**
 * @returns boolean
 */
Folder.prototype.isReadAllowed = function() {
    return this._access == 'WRITE' || this._access == 'READ';
};

/**
 * @returns boolean
 */
Folder.prototype.isReadOnly = function() {
    return !this.isWriteAllowed();
};

/**
 * @returns {String}
 */
Folder.prototype.getParticipants = function() {
    return this._participants;
};

/**
 * @returns {String}
 */
Folder.prototype.getColor = function() {
    return color(this._name);
};

// -----
export {
    Contacts,
    Contact,
    ContactProperty,
    Tag,
    Colleague,
    Tel,
    Group,
    FolderParticipant,
    Folder
}