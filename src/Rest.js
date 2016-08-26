'use strict';

import {JSJaCPacket, JSJaCIQ} from '../include/jsjac';

var NS_REST = "urn:carusto:rest";

/**
 * @returns {JSJaCPacket}
 * @private
 */
export function createRestPacket(method, path, params, timeout) {
    var packet = new JSJaCIQ().setType('get');
    var query = packet.setQuery(NS_REST);
    var request = packet.getDoc().createElement('request');
    request.setAttribute("method", method);
    request.setAttribute("path", path);

    if (timeout) {
        request.setAttribute("timeout", timeout);
    }

    if (params && params['length']) {
        for (var i=0; i < params.length; i++) {
            var param = params[i];
            var el = packet.getDoc().createElement('param');
            el.setAttribute("name", param['name']);
            el.appendChild(packet.getDoc().createTextNode(param['value']));

            request.appendChild(el);
        }
    }

    query.appendChild(request);

    return packet;
}

/**
 * @returns {{result_handler: Function, error_handler: Function}}
 * @private
 */
export function createRestHandler(callback, scope, errorCallback, errorScope) {
    var self = this;
    return {
        result_handler: function(iq) {
            var node = iq.getNode();
            var responses = node.getElementsByTagName("response");
            var result = false;

            if (responses.length > 0) {
                var response = responses.item(0);
                var content = response.childNodes[0].wholeText;
                var json = eval("(function(){return " + content + ";})()");

                result = json['data'];
            }

            if (typeof callback == 'function') {
                callback.call(scope, result);
            }
        },
        error_handler: function(iq) {
            var error = iq.getChild('error');
            var message = "Server error";

            if (error != null) {
                var els = error.getElementsByTagName("text");
                if (els.length > 0) {
                    message = els.item(0).childNodes[0].nodeValue;
                }
            }

            if (errorCallback) {
                errorCallback.call(errorScope, message);
            }
        }
    }
}
