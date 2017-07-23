# mqtt2tivoremote

[![Greenkeeper badge](https://badges.greenkeeper.io/forty2/mqtt2tivoremote.svg)](https://greenkeeper.io/)
> Make TiVo DVR remote control available through an mqtt-smarthome style interface

[![Generated with nod](https://img.shields.io/badge/generator-nod-2196F3.svg?style=flat-square)](https://github.com/diegohaz/nod)
[![NPM version](https://img.shields.io/npm/v/mqtt2tivoremote.svg?style=flat-square)](https://npmjs.org/package/mqtt2tivoremote)
[![Build Status](https://img.shields.io/travis/forty2/mqtt2tivoremote/master.svg?style=flat-square)](https://travis-ci.org/forty2/mqtt2tivoremote) [![Coverage Status](https://img.shields.io/codecov/c/github/forty2/mqtt2tivoremote/master.svg?style=flat-square)](https://codecov.io/gh/forty2/mqtt2tivoremote/branch/master)

`mqtt2tivoremote` is a Node.js application that links TiVo DVRs to an MQTT broker. It is designed to be used to integrate these devices into a home automation system à la [mqtt-smarthome](http://www.github.com/mqtt-smarthome/mqtt-smarthome/).

## Getting Started

`mqtt2tivoremote` is distributed through NPM:

```sh
npm install -g mqtt2tivoremote

# or, if you prefer:
yarn global add mqtt2tivoremote
```

Running it is likewise easy:

```sh
mqtt2tivoremote                      # if your MQTT broker is running on localhost
mqtt2tivoremote -b mqtt://<hostname> # if your broker is running elsewhere
mqtt2tivoremote --help               # to see the full usage documentation
```

## Topics and Payloads

This app is intended to conform to the [mqtt-smarthome](http://www.github.com/mqtt-smarthome/mqtt-smarthome/) architecture.  The topics used by the app are generally of the form:

### Topics Published

| Topic                            | Purpose                                                                          |
|----------------------------------|----------------------------------------------------------------------------------|
| `tivoremote/connected`           | 0 = not connected to anything<br>1 = connected to MQTT but not DVR<br>2 = connected to both.
| `tivoremote/status/channel`      | JSON encoded current channel information<br>schema: `{ channel: num, subchannel: num, reason: string }`
| `tivoremote/status/livetv_ready` | When a teleport to Live TV is attempted, this will be set to false.<br>When LiveTV is being displayed, this will change to true.
| `tivoremote/status/error         | A string containing information about the most recent error to occur.

### Topics Subscribed
For performance reasons, no argument checking is done: if you pass in an invalid IR code, for instance, it will still get sent to the DVR.

| Topic                            | Purpose                                                                          |
|----------------------------------|----------------------------------------------------------------------------------|
| `tivoremote/set/ircode`          | Set to one of the valid IR codes to send that command to the DVR.  No acknowledgement or confirmation will be returned.
| `tivoremote/set/keyboard`        | As above, but for keboard commands rather than IR codes.
| `tivoremote/set/teleport`        | Set to one of TIVO, LIVETV, GUIDE, or NOWPLAYING to jump directly to that screen.  Minimal status is available on `tivoremote/status/teleport`.
| `tivoremote/set/channel`         | Set the DVR to the given channel unless a recording is in progress.  Only works if the DVR is in Live TV mode. Status will be reported on tivoremote/status/channel.  Message format: `{ "channel": num, "subchannel": num }` 
| `tivoremote/set/forcedChannel`   | As above, but will cancel an in-progress recording if necessary

## Contributing

Contributions are of course always welcome.  If you find problems, please report them in the [Issue Tracker](http://www.github.com/forty2/mqtt2tivoremote/issues/).  If you've made an improvement, open a [pull request](http://www.github.com/forty2/mqtt2tivoremote/pulls).

Getting set up for development is very easy:
```sh
git clone <your fork>
cd mqtt2tivoremote
yarn
```

And the development workflow is likewise straightforward:
```sh
# make a change to the src/ file, then...
yarn build
node dist/index.js

# or if you want to clean up all the leftover build products:
yarn run clean
```


## License

MIT © [Zach Bean](https://github.com/forty2). See [LICENSE](LICENSE.md) for more detail.

[npm-image]: https://img.shields.io/npm/v/mqtt2tivoremote.svg?style=flat
[npm-url]: https://npmjs.org/package/mqtt2tivoremote
