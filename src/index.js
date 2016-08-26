'use strict';

import {createRestPacket, createRestHandler} from './Rest';

import Connection from './Connection';
import {Pub, PubSubEvent, PubSubNode, PubSubItem} from './Pub';
import {Ac, Registration, Call, CallResource, CallMineResource} from './Ac'
import {Cc, Queue, QueueCall, QueueCallFlow} from './Cc';
import {Conferences, Conference, ConferencePresence, ConferenceParticipant, ConferenceMessage} from './Conferences';
import {Contacts, Contact, ContactProperty, Tag, Colleague, Tel, Group, FolderParticipant, Folder} from './Contacts';
import {Conversations, Message} from './Conversations';
import {Native, SoftPhoneCall} from './Native';
import {Presences, Presence} from './Presences';
import {Settings} from './Settings';

Connection.addPlugin("pub", Pub);
Connection.addPlugin("ac", Ac);
Connection.addPlugin("cc", Cc);
Connection.addPlugin("conferences", Conferences);
Connection.addPlugin("contacts", Contacts);
Connection.addPlugin("conversations", Conversations);
Connection.addPlugin("native", Native);
Connection.addPlugin("presences", Presences);
Connection.addPlugin("settings", Settings);

export {
    createRestPacket,
    createRestHandler,

    Connection,

    PubSubEvent, PubSubNode, PubSubItem,
    Registration, Call, CallResource, CallMineResource,
    Queue, QueueCall, QueueCallFlow,
    Conference, ConferencePresence, ConferenceParticipant, ConferenceMessage,
    Contact, ContactProperty, Tag, Colleague, Tel, Group, FolderParticipant, Folder,
    Message,
    SoftPhoneCall,
    Presence
};