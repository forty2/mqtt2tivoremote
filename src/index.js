#!/usr/bin/env node

import log from 'yalm';

import MQTT from 'mqtt';

import TiVoDiscovery from 'tivo-remote';
import { Observable, Subject } from 'rxjs';

import config from './config.js';

log.setLevel(config.verbosity);

/*
    * Topics published:
    * <prefix> expands to tivoremote/<TSN> and tivoremote/<Friendly Name>
    * connected status will be retained; the other statuses are transient.
    *
    *   - <prefix>/connnected          -- 0 = not connected to anything, 1 = connected to MQTT but not DVR, 2 = connected to both.
    *   - <prefix>/status/channel      -- JSON encoded current channel information
    *                                     schema: { channel: num, subchannel: num, reason: string }
    *   - <prefix>/status/livetv_ready -- When a teleport to Live TV is attempted, this will be set to false.
    *                                     When LiveTV is being displayed, this will change to true.
    *   - <prefix>/status/error        -- A string containing information about the most recent error to occur.
    *
    * Topics subscribed:
    * For performance reasons, no argument checking is done: if you pass in an invalid IR code, for instance, it
    * will still get sent to the DVR.
    *   - <prefix>/set/ircode         -- Set to one of the valid IR codes to send that command to the DVR.  No acknowledgement or
    *                                    confirmation will be returned.
    *   - <prefix>/set/keyboard       -- as above, but for keboard commands rather than IR codes.
    *   - <prefix>/set/teleport       -- message: one of TIVO, LIVETV, GUIDE, or NOWPLAYING.  Jumps directly to that screen.
    *                                    minimal status available on <prefix>/status/teleport.
    *   - <prefix>/set/channel        -- set the DVR to the given channel (JSON format; { "channel": num, "subchannel": num })
    *                                    unless a recording is in progress.  Only works if the DVR is in Live TV mode.
    *                                    status will be reported on <prefix>/status/channel.
    *   - <prefix>/set/forcedChannel  -- as above, but will cancel an in-progress recording if necessary
    */

const STATUS_OPTS = { qos: 2, retain: true };

class MQTTBridge {
    constructor(discoverer) {
        this._discoverer = discoverer;

        this._clients = { };
        this._subjects = { };
    }

    start() {
        this._discoverer
            .on('founddevice', ::this._setupNewDevice)
            .on('lostdevice',  ::this._forgetDevice)
            .discover();
    }

    _getTopic(dev, suffix) {
        return `${config.name}:${dev.id}/${suffix}`;
    }

    _setupNewDevice(device) {
        log.debug(`Creating client for ${device.name}`);
        let client;
        if (!this._clients[device.id]) {
            this._clients[device.id] = client = MQTT.connect(config.broker, {
                will: {
                    topic:   this._getTopic(device, 'connected'),
                    payload: '0',
                    ...STATUS_OPTS
                }
            });
        }

        client.publish(this._getTopic(device, 'connected'), '2', STATUS_OPTS);

        this._subjects[device.id] = new Subject();

        // listen for stuff that needs publishing
        this.outgoingMessages(device)
            .takeUntil(this._subjects[device.id])
            ::publishMessages();

        // listen for incoming messages to act on
        this._handleIncomingMessages(device)
    }

    _forgetDevice(device) {
        this._clients[device.id].publish(
            this._getTopic(device, 'connected'), '1', STATUS_OPTS);

        this._subjects[device.id].next();
        this._subjects[device.id] = undefined;
    }

    _getMessages(client, ...topics) {
        return new Observable(
            subscriber => {
                client.subscribe(topics);
                client.on('message', (m_topic, msg) => {
                    if (topics.includes(m_topic)) {
                        subscriber.next({
                            topic: m_topic,
                            message: msg.toString()
                        })
                    }
                });

                return () => {
                    client.unsubscribe(topics);
                }
            }
        ).catch((_, caught) => caught);
    }
}

function publishMessage({ topic, message, client, retain }) {
    client.publish(topic, message !== null ? message.toString() : null, { qos: 2, retain });
}

function NOOP() { }
function publishMessages(onError = NOOP, onComplete = NOOP) {
    return this.subscribe(
        publishMessage,
        onError,
        onComplete
    );
}

class TiVoBridge extends MQTTBridge {
    constructor() {
        super(TiVoDiscovery);
        this._livetvTeleports = new Subject();
    }

    outgoingMessages(device) {
        const topic = p => this._getTopic(device, p);

        return Observable.merge(
            Observable
                .fromEvent(device, 'error',
                    ({ reason }) => ({
                        topic: topic('status/error'),
                        message: reason
                    })),

            Observable.merge(
                Observable
                    .fromEvent(device, 'livetvready'),
                this._livetvTeleports
            )
            .map(({ isReady }) => ({
                topic:   topic('status/livetv_ready'),
                message: isReady.toString()
            })),

            Observable
                .fromEvent(device, 'channelchange',
                    ({ success, ...rest }) => ({
                        topic: topic('status/channel'),
                        message: JSON.stringify(rest)
                    }))
        )
        .map(props => ({
            client: this._clients[device.id],
            retain: true,
            ...props
        }))
    }

    _handleIncomingMessages(device) {
        const client = this._clients[device.id];
        const messages = t => this._getMessages(client, this._getTopic(device, t));

        Observable.merge(
            messages('set/ircode'),
            messages('set/keyboard'),
            messages('set/teleport')
        )
        .subscribe(
            ({ topic, message }) => {
                let cmd = topic.split('/').pop();
                if (cmd === 'ircode') {
                    device.sendIrcode(message);
                }
                else if (cmd === 'keyboard') {
                    device.sendKeyboardCode(message);
                }
                else if (cmd === 'teleport') {
                    if (message === 'livetv') {
                        this._livetvTeleports({ isReady: false });
                    }
                    device.teleport(message);
                }
                else if (cmd === 'channel') {
                    device.setChannel(message);
                }
                else if (cmd === 'forcedChannel') {
                    device.setChannel(message, true);
                }
            }
        );
    }
}

new TiVoBridge().start();
