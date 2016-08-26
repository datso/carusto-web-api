import Observable from './Observable';
import {createRestPacket, createRestHandler} from './Rest';

var NS_REST = "urn:carusto:rest";

/**
 * @param connection
 * @constructor
 */
function Cdr(connection) {
    this._con = connection;

    // Initialize supper
    Observable.call(this);
}

Cdr.prototype = Object.create(Observable.prototype);

// ============================================================
// Public events
// ============================================================

// ============================================================
// Public functions
// ============================================================

Cdr.prototype.getPersonalHistory = function(limit, offset, type, callback, scope) {
    var params = [
        {name: "limit", value: limit},
        {name: "offset", value: offset}
    ];

    var packet = createRestPacket("GET", this._getUrl(type), params);
    var handler = createRestHandler(callback, scope);
    this._con.sendIQ(packet, handler);
};

Cdr.prototype._getUrl = function(type) {
    switch (type) {
        case 'outgoing': {
            return '/api/me/history/outgoing/'
        }
        case 'incoming': {
            return '/api/me/history/incoming/'
        }
        case 'missed': {
            return '/api/me/history/missed/'
        }
        default: {
            return '/api/me/history/'
        }
    }
};

Cdr.prototype.getHistory = function(filter, callback, scope, errorCallback, errorScope) {
    var params = [];
    if (filter['participants']  && filter['participants']['length']) {
        let items = filter['participants'];
        for (let i=0; i < items.length; i++) {
            params.push({name: 'participant', value: JSON.stringify(items[i])})
        }
    }
    if (filter['tags'] && filter['tags']['length']) {
        let items = filter['tags'];
        for (let i=0; i < items.length; i++) {
            params.push({name: 'tag', value: items[i]})
        }
    }
    if (filter['conditions']  && filter['conditions']['length']) {
        let items = filter['conditions'];
        for (let i=0; i < items.length; i++) {
            params.push({name: 'condition', value: JSON.stringify(items[i])})
        }
    }

    params.push({name: "limit", value: filter['limit']});
    params.push({name: "offset", value: filter['offset']});
    params.push({name: "order", value: "id"});
    params.push({name: "period", value: filter['period']});

    if (filter['period'] == 'CUSTOM') {
        var periodFrom = filter['periodFromDate'] + " " + filter['periodFromTime'];
        var periodTo = filter['periodToDate'] + " " + filter['periodToTime'];

        params.push({name: "periodFrom", value: periodFrom});
        params.push({name: "periodTo", value: periodTo});
    }

    if (filter['summary']) {
        params.push({name: "summary", value: "true"});
    }

    var packet = createRestPacket("GET", '/api/cdr/', params);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Cdr.prototype.getFilterParticipants = function(callback, scope) {
    var packet = createRestPacket("GET", '/api/cdr/participants/');
    var handler = createRestHandler(callback, scope);
    this._con.sendIQ(packet, handler);
};

export {
    Cdr
}