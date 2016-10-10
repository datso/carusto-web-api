import EventEmitter from 'event-emitter-es6'


// TODO: color

export class ContactsPlugin extends EventEmitter {

}

export class PersonProperty {
    constructor({key, type, value}) {
        this._key = key;
        this._type = type;
        this._value = value;
    }

    getKey() {
        return this._key;
    }

    getType() {
        return this._type;
    }

    getValue() {
        return this._value;
    }

    stringify() {
        return JSON.stringify({
            key: this._key,
            type: this._type,
            value: this._value
        });
    }
}

export class Person {

    constructor(info) {
        this._info = info;
    }

    /**
     * @returns {String}
     */
    getType = function() {
        return "person";
    };

    /**
     * Iterate over all properties and return a first one for Provided key.
     *
     * @param {String} key
     * @returns {PersonProperty|null}
     */
    getProperty(key) {
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
     * @returns {PersonProperty|null}
     */
    getPropertyValue(key) {
        var property = this.getProperty(key);

        if (property) {
            return property.getValue();
        }

        return null;
    }

    /**
     * Iterate over all properties and return that has Provided key.
     *
     * @param {String} key
     * @returns {PersonProperty[]}
     */
    getProperties(key) {
        var result = [];
        for (var i=0; i < this._info.length; i++) {
            var prop = this._info[i];

            if (prop.getKey() == key) {
                result.push(prop);
            }
        }

        return result;
    }

    /**
     * Iterate over all properties and return concatenated String.
     *
     * @param {String} key
     * @returns {String}
     */
    getPropertiesValue(key) {
        var result = [];
        for (var i=0; i < this._info.length; i++) {
            var prop = this._info[i];

            if (prop.getKey() == key) {
                result.push(prop.getValue());
            }
        }

        return result.join(", ");
    }

    /**
     * @returns {PersonProperty[]}
     */
    getInfo() {
        return this._info;
    }

    /**
     * @returns {String[]}
     */
    getInfoValues() {
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
    }

    /**
     * @returns {String}
     */
    getFormattedName() {
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

        return "Undefined";
    }

    /**
     * @returns {String}
     */
    getAbbr() {
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
    }

    /**
     * @returns {String}
     */
    getAvatarURL() {
        return "/avatars/default/";
    };

    /**
     * @returns {String}
     */
    getSmallAvatarURL() {
        return "/avatars/default/small/";
    };

    /**
     * @returns {String}
     */
    getMediumAvatarURL() {
        return "/avatars/default/medium/";
    };

    /**
     * @returns {String}
     */
    getLargeAvatarURL() {
        return "/avatars/default/large/";
    };

    /**
     * @returns {String}
     */
    getColor() {
        return color(this.getFormattedName());
    };

    /**
     * @returns {String}
     */
    getDescription() {
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
    }
}
