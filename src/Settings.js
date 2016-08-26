import Observable from './Observable';
import {createRestPacket, createRestHandler} from './Rest';

/**
 * @param connection
 * @constructor
 */
function Settings(connection) {
    this._con = connection;

    // Initialize supper
    Observable.call(this);
}

Settings.prototype = Object.create(Observable.prototype);

Settings.prototype.changePersonalSettings = function(params, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("PUT", "/api/me/update", params);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Settings.prototype.changeFeaturesSettings = function(params, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("PUT", "/api/me/features", params);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

Settings.prototype.changePasswords = function(params, callback, scope, errorCallback, errorScope) {
    var packet = createRestPacket("PUT", "/api/me/password", params);
    var handler = createRestHandler(callback, scope, errorCallback, errorScope);
    this._con.sendIQ(packet, handler);
};

export {
    Settings
}
