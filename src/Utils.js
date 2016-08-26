
export function proxy(callback, scope) {
    var args = arguments.length > 2 ? Array.prototype.slice.call(arguments, 2) : [];

    return function() {
        for (var i=0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }

        callback.apply(scope, args);
    }
};

/**
 * @returns {{error_handler: Function, result_handler: Function}}
 * @private
 */
export function proxyIq(callback, scope) {
    return {
        error_handler: function(iq) {
            callback.call(scope, Response.fromErrorIq(iq));
        },
        result_handler: function(iq) {
            callback.call(scope, Response.fromResultIq(iq));
        }
    }
};

/**
 * Removes all non-printable characters for string
 *
 * @param {String} str
 */
export function text(str) {
    for (var i=0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        if (code < 31 && code != 9 && code != 10) {
            return str.slice(0, i) + this.text(str.slice(i + 1));
        }
    }

    return str;
};

export function nodeValue(node) {
    var ret = '';
    if (node && node.hasChildNodes()) {
        // concatenate all values from childNodes
        for (var i=0; i<node.childNodes.length; i++)
            if (node.childNodes.item(i).nodeValue)
                ret += node.childNodes.item(i).nodeValue;
    }
    return ret;
};

export function color(str) {
    var hash = 0,
        rgb = [],
        i;

    for (i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    for (i = 0; i < 3; i++) {
        rgb[i] = ((hash >> (i * 8)) & 0xFF);
        rgb[i] = Math.ceil((rgb[i] + 255) / 2);
    }

    var min = Math.min.apply(null, rgb);
    var max = Math.max.apply(null, rgb);

    rgb[rgb.indexOf(min)] = 100;
    rgb[rgb.indexOf(max)] = Math.ceil(max > 180 ? max / 2 : (max + 255) / 2);

    for (i = 0; i < 3; i++) {
        rgb[i] = ('00' + rgb[i].toString(16)).substr(-2);
    }

    return "#" + rgb.join("");
};


/**
 * @public
 * @constructor
 */
export function Response(iq) {
    this._iq = iq;
    this._data = null;
    this._error = null;
    this._extra = null;
}

Response.fromErrorIq = function(iq) {
    var node = iq.getNode();
    var errors = node.getElementsByTagName("error");
    var result = new Response(iq);

    if (errors.length > 0) {
        var error = errors[0];
        var type = error.firstChild;
        if (type) {
            result._error = type.tagName;
        }
    }

    return result;
};

Response.fromErrorData = function(error) {
    var result = new Response(null);
    result._error = error;

    return result;
};

Response.fromResultIq = function(iq) {
    var result = new Response(iq);
    var node = iq.getNode();
    var responses = node.getElementsByTagName("response");

    if (responses.length > 0) {
        result._data = nodeValue(responses.item(0));

        try {
            result._json = JSON.parse(result._data);

            if (result._json.hasOwnProperty("success") && !result._json['success']) {
                result._error = result._json.hasOwnProperty('message') ? result._json['message'] : result._json['code'];
            }
        } catch (e) {
            // Ignore
        }
    }

    return result;
};

Response.fromResultData = function(data) {
    var result = new Response(null);
    result._data = data;

    return result;
};

Response.prototype.isSuccess = function() {
    return this._error == null;
};

Response.prototype.isFailure = function() {
    return this._error != null;
};

Response.prototype.getIq = function() {
    return this._iq;
};

Response.prototype.getError = function() {
    return this._error;
};

Response.prototype.getData = function() {
    return this._data;
};

Response.prototype.getJson = function() {
    if (!this._json) {
        this._json = JSON.parse(this._data);
    }

    return this._json;
};

Response.prototype.getExtra = function() {
    return this._extra;
};