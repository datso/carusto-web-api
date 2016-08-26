'use strict';

import {createRestPacket, createRestHandler} from './src/Rest';

import Connection from './src/Connection';
import {Pub, PubSubEvent, PubSubNode, PubSubItem} from './src/Pub';
import {Ac, Registration, Call, CallResource, CallMineResource} from './src/Ac'
import {Cc, Queue, QueueCall, QueueCallFlow} from './src/Cc';
import {Conferences, Conference, ConferencePresence, ConferenceParticipant, ConferenceMessage} from './src/Conferences';
import {Contacts, Contact, ContactProperty, Tag, Colleague, Tel, Group, FolderParticipant, Folder} from './src/Contacts';
import {Conversations, Message} from './src/Conversations';
import {Native, SoftPhoneCall} from './src/Native';
import {Presences, Presence} from './src/Presences';
import {Settings} from './src/Settings';

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