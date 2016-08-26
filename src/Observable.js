
/**
 * @constructor
 */
function Observable() {
    this._listeners = {};
}

/**
 * Registers a listener to receive events.
 *
 * @alias on
 * @param event {string}
 * @param callback {function}
 */
Observable.prototype.addListener = function(event, callback) {
    if (!callback) {
        throw new Error("Invalid callback");
    }

    var scope = arguments[2] || this;
    var handler = {
        callback: callback,
        scope: scope
    }
    if (typeof(this._listeners[event]) === "undefined") {
        this._listeners[event] = [handler];
    } else {
        this._listeners[event].push(handler);
    }
};

Observable.prototype.on = Observable.prototype.addListener;

/**
 * Removes a previously registered listener.
 *
 * @param event
 * @param callback
 */
Observable.prototype.removeListener = function(event, callback) {
    var listeners = this._listeners[event];
    if (typeof(listeners) !== "undefined") {
        var filtered = [];
        for(var i=0; i < listeners.length; i++) {
            if (listeners[i]['callback'] != callback) {
                filtered.push(listeners[i]);
            }
        }
        this._listeners[event] = filtered;
    }
};

Observable.prototype.un = Observable.prototype.removeListener;

/**
 * Broadcast event to listeners.
 *
 * @param event
 * @private
 */
Observable.prototype._fire = function(event) {
    var listeners = this._listeners[event];
    var args = Array.prototype.slice.call(arguments, 1, arguments.length);

    if (typeof(listeners) !== "undefined") {
        for(var i=0; i < listeners.length; i++) {
            var listener = listeners[i];
            (function(l) {
                setTimeout(function() {
                    l.callback.apply(l.scope, args);
                }, 0);
            })(listener);
        }
    }
};

export default Observable;