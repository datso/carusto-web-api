import EventEmitter from 'event-emitter-es6'

/**
 * Conversations plugin allows to chat with colleagues or participate in conferences.
 */
export class PresencesPlugin extends EventEmitter {

    constructor(connection) {
        super();

        this._con = connection;
    }

}