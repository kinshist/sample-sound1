(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AudioNodes {
    constructor(audioBufferSourceNode, gainNode) {
        this.audioSrc = null;
        this._gain = null;
        this._tail = null;
        this._volume = 1;
        this._masterVolume = 1;
        this.audioSrc = audioBufferSourceNode;
        this._gain = gainNode;
        this._tail = this.audioSrc;
    }
    set volume(val) {
        this._volume = val;
        this._setVolume();
    }
    get volume() {
        return this._volume;
    }
    set masterVolume(val) {
        this._masterVolume = val;
        this._setVolume();
    }
    get masterVolume() {
        return this._masterVolume;
    }
    _setVolume() {
        if (this._gain !== null)
            this._gain.gain.value = this.volume * this.masterVolume;
    }
    connect(audioNode) {
        var _a;
        (_a = this._tail) === null || _a === void 0 ? void 0 : _a.connect(audioNode);
        this._tail = audioNode;
        return this;
    }
}
exports.default = AudioNodes;

},{}],3:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const audioNode_1 = __importDefault(require("./audioNode"));
const tween_1 = __importDefault(require("./tween"));
class AudioSource {
    constructor() {
        this._audioArrayBuffer = null;
        this._audioBuffer = null;
        this._audioList = new Map();
        this._cnt = 1000;
        this._json = null;
        this._hasStartedLoading = false;
        this._hasLoaded = false;
        this._hasStartedAnalysis = false;
        this._hasAnalyzed = false;
        this._masterVolume = 1;
        this._analyzePromise = null;
        AudioSource._instances.push(this);
    }
    static get isActive() {
        return this._isActive;
    }
    static activate() {
        if (this._isActive)
            return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this._ctx = new AudioContext();
            const emptySrc = this._ctx.createBufferSource();
            emptySrc.start();
            emptySrc.stop();
            this._isActive = true;
            this._analyzeAllInstances();
        }
        catch (err) {
            throw new Error(`an err occurred while AudioSource.setup ${err}`);
        }
    }
    static _analyzeAllInstances() {
        this._instances.forEach((instance) => {
            if (instance._hasLoaded && !instance._hasStartedAnalysis) {
                instance.analyze();
            }
        });
    }
    static _createAudioBuffer(buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (typeof Promise !== 'undefined' && this._ctx.decodeAudioData.length === 1) {
                    return yield this._ctx.decodeAudioData(buffer);
                }
                else {
                    return new Promise((res, rej) => {
                        this._ctx.decodeAudioData(buffer, (data) => res(data), (err) => rej(err));
                    });
                }
            }
            catch (err) {
                throw new Error(`an err occured while AudioSource._createAudioBuffer ${err}`);
            }
        });
    }
    static _createAudioArrayBuffer(audioSrc) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield fetch(audioSrc);
                const arrayBuffer = yield res.arrayBuffer();
                return arrayBuffer;
            }
            catch (err) {
                throw new Error(`an err occurred while AudioSource._createAudioArrayBuffer ${err}`);
            }
        });
    }
    get _uniqueKey() {
        return this._cnt++;
    }
    set masterVolume(val) {
        this._masterVolume = val;
        this._audioList.forEach((audio) => {
            audio.nodes.masterVolume = this._masterVolume;
        });
    }
    get masterVolume() {
        return this._masterVolume;
    }
    load(audioSrc, json) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._hasStartedLoading) {
                console.warn("The file has already started loading.");
                return;
            }
            this._json = json;
            this._hasStartedLoading = true;
            try {
                this._audioArrayBuffer = yield AudioSource._createAudioArrayBuffer(audioSrc);
                this._hasLoaded = true;
            }
            catch (err) {
                if (err instanceof Error)
                    throw err;
                else
                    throw new Error("unknown error");
            }
        });
    }
    analyze() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!AudioSource.isActive)
                return;
            if (this._hasStartedAnalysis) {
                console.warn("analyze(): AudioBuffer has already started analysis");
                return;
            }
            if (!this._hasLoaded || this._audioArrayBuffer == null) {
                console.warn("analyze(): The file hasn't loaded yet.");
                return;
            }
            this._hasStartedAnalysis = true;
            try {
                this._analyzePromise = AudioSource._createAudioBuffer(this._audioArrayBuffer);
                this._audioBuffer = yield this._analyzePromise;
                this._analyzePromise = null;
                this._hasAnalyzed = true;
            }
            catch (err) {
                if (err instanceof Error)
                    throw err;
                else
                    throw new Error("unknown error");
            }
        });
    }
    play(key, options) {
        var _a, _b;
        if (!this._hasLoaded) {
            console.warn("play(): The file hasn't loaded yet.");
            return -999;
        }
        if (!this._hasAnalyzed) {
            if (!this._hasStartedAnalysis) {
                try {
                    AudioSource.activate();
                }
                catch (err) {
                    console.warn("play(): Can not play audio before initialization (AudioContext must be initialization by pointer event).");
                    return -999;
                }
            }
            if (this._analyzePromise != null) {
                const id = this._uniqueKey;
                this._playLater(id, key, options);
                return id;
            }
            else {
                console.warn(("_analyzePromise is null"));
                return -999;
            }
        }
        if (this._json === null || !this._json.spritemap || !(key in this._json.spritemap)) {
            throw new Error(`json error: ${this._json}`);
        }
        if (((_a = AudioSource._ctx) === null || _a === void 0 ? void 0 : _a.state) == "interrupted") {
            const id = this._uniqueKey;
            (_b = AudioSource._ctx) === null || _b === void 0 ? void 0 : _b.resume().then(() => {
                this.play(key, options);
            });
            return id;
        }
        const id = this._uniqueKey;
        this._play(id, key, options);
        this.setLoop(options.loop, id);
        this.setVolume(options.volume, id);
        return id;
    }
    stop(id, delay = 0) {
        var _a;
        if (!this._audioList.has(id))
            return;
        (_a = this._audioList.get(id)) === null || _a === void 0 ? void 0 : _a.nodes.audioSrc.stop(AudioSource._ctx.currentTime + delay);
        this._audioList.delete(id);
    }
    setVolume(vol, id) {
        var _a;
        if (!this._audioList.has(id))
            return;
        const audioNodes = (_a = this._audioList.get(id)) === null || _a === void 0 ? void 0 : _a.nodes;
        if (audioNodes !== null && audioNodes.volume !== null)
            audioNodes.volume = vol;
    }
    setLoop(loop, id) {
        var _a, _b;
        if (!this._audioList.has(id))
            return;
        const key = (_a = this._audioList.get(id)) === null || _a === void 0 ? void 0 : _a.key;
        const audioNodes = (_b = this._audioList.get(id)) === null || _b === void 0 ? void 0 : _b.nodes;
        if (loop) {
            const start = this._json.spritemap[key].start;
            const end = this._json.spritemap[key].end;
            audioNodes.audioSrc.loop = true;
            audioNodes.audioSrc.loopStart = start;
            audioNodes.audioSrc.loopEnd = end;
        }
        else {
            audioNodes.audioSrc.loop = false;
        }
    }
    fade(volTo, duration, id) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._audioList.has(id))
                return;
            const audioNodes = (_a = this._audioList.get(id)) === null || _a === void 0 ? void 0 : _a.nodes;
            yield new Promise((res) => {
                tween_1.default.to(audioNodes, "volume", volTo, {
                    duration: duration,
                    onComplete: res
                });
            });
        });
    }
    fadeAll(volTo) {
        this._audioList.forEach((_, id) => {
            this.fade(volTo, 0.5, id).then(_ => this.stop(id));
        });
    }
    _play(id, key, options) {
        const audioSrc = AudioSource._ctx.createBufferSource();
        audioSrc.buffer = this._audioBuffer;
        const gainNode = AudioSource._ctx.createGain();
        const audioNodes = new audioNode_1.default(audioSrc, gainNode);
        audioNodes.masterVolume = this.masterVolume;
        audioNodes.connect(gainNode).connect(AudioSource._ctx.destination);
        const start = this._json.spritemap[key].start;
        const end = this._json.spritemap[key].end;
        if (options.loop) {
            audioNodes.audioSrc.start(AudioSource._ctx.currentTime + options.delay, start, end);
        }
        else {
            const dur = Math.max(end - start, 0.1);
            audioNodes.audioSrc.start(AudioSource._ctx.currentTime + options.delay, start, dur);
        }
        audioNodes.audioSrc.onended = () => {
            this.stop(id);
            audioNodes.audioSrc.disconnect();
            audioNodes.audioSrc.buffer = null;
            options.callback(id);
        };
        this._audioList.set(id, {
            key,
            nodes: audioNodes,
        });
    }
    _playLater(id, key, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._analyzePromise;
            this._play(id, key, options);
        });
    }
}
exports.default = AudioSource;
AudioSource.END = "end";
AudioSource._instances = [];
AudioSource._ctx = null;
AudioSource._isActive = false;

},{"./audioNode":2,"./tween":11}],4:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOGGLE_SOUND_KEYS = exports.TYPE_SOUND_KEYS = exports.SWIPE_SOUND_KEYS = exports.TAP_SOUND_KEYS = exports.EVENT_CLASS_NAMES = exports.SOUNDS = exports.ENABLE_TAGS = exports.KIT_INFO = exports.KITS = void 0;
const _01_json_1 = __importDefault(require("./json/01.json"));
const _02_json_1 = __importDefault(require("./json/02.json"));
const BUTTON = "button";
const CAUTION = "caution";
const CELEBRATION = "celebration";
const DISABLED = "disabled";
const NOTIFICATION = "notification";
const PROGRESS_LOOP = "progress_loop";
const RINGTONE_LOOP = "ringtone_loop";
const SELECT = "select";
const SWIPE = "swipe";
const SWIPE_01 = "swipe_01";
const SWIPE_02 = "swipe_02";
const SWIPE_03 = "swipe_03";
const SWIPE_04 = "swipe_04";
const SWIPE_05 = "swipe_05";
const TAP = "tap";
const TAP_01 = "tap_01";
const TAP_02 = "tap_02";
const TAP_03 = "tap_03";
const TAP_04 = "tap_04";
const TAP_05 = "tap_05";
const TOGGLE = "toggle";
const TOGGLE_OFF = "toggle_off";
const TOGGLE_ON = "toggle_on";
const TRANSITION_DOWN = "transition_down";
const TRANSITION_UP = "transition_up";
const TYPE = "type";
const TYPE_01 = "type_01";
const TYPE_02 = "type_02";
const TYPE_03 = "type_03";
const TYPE_04 = "type_04";
const TYPE_05 = "type_05";
const TAP_SOUND_KEYS = [
    TAP_01,
    TAP_02,
    TAP_03,
    TAP_04,
    TAP_05
];
exports.TAP_SOUND_KEYS = TAP_SOUND_KEYS;
const SWIPE_SOUND_KEYS = [
    SWIPE_01,
    SWIPE_02,
    SWIPE_03,
    SWIPE_04,
    SWIPE_05
];
exports.SWIPE_SOUND_KEYS = SWIPE_SOUND_KEYS;
const TYPE_SOUND_KEYS = [
    TYPE_01,
    TYPE_02,
    TYPE_03,
    TYPE_04,
    TYPE_05
];
exports.TYPE_SOUND_KEYS = TYPE_SOUND_KEYS;
const TOGGLE_SOUND_KEYS = [
    TOGGLE_ON,
    TOGGLE_OFF
];
exports.TOGGLE_SOUND_KEYS = TOGGLE_SOUND_KEYS;
const _SOUND_KEYS = {
    BUTTON,
    CAUTION,
    CELEBRATION,
    DISABLED,
    NOTIFICATION,
    PROGRESS_LOOP,
    RINGTONE_LOOP,
    SELECT,
    SWIPE,
    TAP,
    TOGGLE_ON,
    TOGGLE_OFF,
    TRANSITION_DOWN,
    TRANSITION_UP,
    TYPE
};
const _EVENT_CLASS_NAMES = {
    [BUTTON]: `snd__${BUTTON}`,
    [CAUTION]: `snd__${CAUTION}`,
    [CELEBRATION]: `snd__${CELEBRATION}`,
    [DISABLED]: `snd__${DISABLED}`,
    [NOTIFICATION]: `snd__${NOTIFICATION}`,
    [PROGRESS_LOOP]: `snd__${PROGRESS_LOOP}`,
    [RINGTONE_LOOP]: `snd__${RINGTONE_LOOP}`,
    [SELECT]: `snd__${SELECT}`,
    [SWIPE]: `snd__${SWIPE}`,
    [TAP]: `snd__${TAP}`,
    [TOGGLE]: `snd__${TOGGLE}`,
    [TRANSITION_DOWN]: `snd__${TRANSITION_DOWN}`,
    [TRANSITION_UP]: `snd__${TRANSITION_UP}`,
    [TYPE]: `snd__${TYPE}`,
};
const SOUNDS = Object.freeze(_SOUND_KEYS);
exports.SOUNDS = SOUNDS;
const EVENT_CLASS_NAMES = Object.freeze(_EVENT_CLASS_NAMES);
exports.EVENT_CLASS_NAMES = EVENT_CLASS_NAMES;
const TAG_EVENT_SOUND = {
    "input:text,email,number,password,search,url,tel": {
        events: {
            "input": "type"
        }
    },
    "input:checkbox": {
        events: {
            "change": "toggle"
        }
    },
    "input:radio": {
        events: {
            "change": "select"
        }
    },
    "input:button,reset,submit": {
        events: {
            "click": "button,caution,celebration,disabled,notification,tap,transition_down,transition_up"
        }
    },
    "select": {
        events: {
            "change": "select"
        }
    },
    "any": {
        events: {
            "click": "button,caution,celebration,disabled,notification,tap,transition_down,transition_up"
        }
    }
};
exports.ENABLE_TAGS = TAG_EVENT_SOUND;
const _KITS = {
    SND01: "01",
    SND02: "02"
};
const KITS = Object.freeze(_KITS);
exports.KITS = KITS;
const _KIT_INFO = {
    [KITS.SND01]: {
        json: _01_json_1.default,
        audioSrc: "https://cdn.jsdelivr.net/gh/snd-lib/snd-lib@v1.0.0/assets/sounds/sprite/01/audioSprite.mp3",
    },
    [KITS.SND02]: {
        json: _02_json_1.default,
        audioSrc: "https://cdn.jsdelivr.net/gh/snd-lib/snd-lib@v1.0.0/assets/sounds/sprite/02/audioSprite.mp3",
    },
};
const KIT_INFO = Object.freeze(_KIT_INFO);
exports.KIT_INFO = KIT_INFO;

},{"./json/01.json":7,"./json/02.json":8}],5:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const constant_1 = require("./constant");
const isTouchDevice = typeof window !== "undefined" && window.ontouchstart !== undefined;
class DOMInteraction extends events_1.default {
    constructor() {
        super();
        this._init();
    }
    _init() {
        for (const key in constant_1.EVENT_CLASS_NAMES) {
            const className = constant_1.EVENT_CLASS_NAMES[key];
            const elements = document.getElementsByClassName(className);
            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                const soundKey = key.replace("snd__", "");
                const eventName = this._getEventName(soundKey, el);
                if (eventName == null)
                    break;
                this._listen(el, eventName, soundKey);
            }
        }
    }
    _getEventName(soundKey, element) {
        const tagName = element.tagName.toLowerCase();
        for (const tagString in constant_1.ENABLE_TAGS) {
            if (tagName == "input" && tagString.match("input") != null) {
                const type = element.type || "";
                const types = tagString.split(":")[1].split(",");
                for (const event in constant_1.ENABLE_TAGS[tagString].events) {
                    for (const i in types) {
                        if (type != types[i])
                            continue;
                        const sounds = constant_1.ENABLE_TAGS[tagString].events[event].split(",");
                        for (const j in sounds) {
                            if (soundKey == sounds[j])
                                return event;
                        }
                    }
                }
            }
            else {
                if (tagString == tagName || tagString == "any") {
                    for (const event in constant_1.ENABLE_TAGS[tagString].events) {
                        const sounds = constant_1.ENABLE_TAGS[tagString].events[event].split(",");
                        for (const i in sounds) {
                            if (soundKey == sounds[i])
                                return event;
                        }
                    }
                }
            }
        }
        return null;
    }
    _listen(element, eventName, soundKey) {
        element.addEventListener(eventName, (e) => this._process(e, eventName, soundKey));
    }
    _process(e, eventName, soundKey) {
        const target = e.target;
        if (!target.classList.contains(`snd__${soundKey}`))
            return;
        if (soundKey == "toggle") {
            soundKey = target.checked ? constant_1.TOGGLE_SOUND_KEYS[0] : constant_1.TOGGLE_SOUND_KEYS[1];
        }
        this._emit(target, eventName, soundKey);
    }
    _emit(DOM, event, soundKey) {
        if (document.documentElement.classList.contains("muted"))
            return;
        this.emit(DOMInteraction.INTERACT, soundKey);
    }
}
exports.default = DOMInteraction;

},{"./constant":4,"events":1}],6:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snd_1 = __importDefault(require("./snd"));
exports.default = snd_1.default;

},{"./snd":9}],7:[function(require,module,exports){
module.exports={
    "resources": [
        "./assets/sounds/sprite/01/audioSprite.ogg",
        "./assets/sounds/sprite/01/audioSprite.m4a",
        "./assets/sounds/sprite/01/audioSprite.mp3",
        "./assets/sounds/sprite/01/audioSprite.ac3"
    ],
    "spritemap": {
        "button": {
            "start": 0,
            "end": 0.1001814058956916,
            "loop": false
        },
        "caution": {
            "start": 2,
            "end": 2.160544217687075,
            "loop": false
        },
        "celebration": {
            "start": 4,
            "end": 5,
            "loop": false
        },
        "disabled": {
            "start": 6,
            "end": 6.070113378684807,
            "loop": false
        },
        "notification": {
            "start": 8,
            "end": 8.30031746031746,
            "loop": false
        },
        "progress_loop": {
            "start": 10,
            "end": 11.5,
            "loop": false
        },
        "ringtone_loop": {
            "start": 13,
            "end": 15,
            "loop": false
        },
        "select": {
            "start": 16,
            "end": 16.1,
            "loop": false
        },
        "swipe": {
            "start": 18,
            "end": 18.15,
            "loop": false
        },
        "swipe_01": {
            "start": 20,
            "end": 20.15,
            "loop": false
        },
        "swipe_02": {
            "start": 22,
            "end": 22.150272108843538,
            "loop": false
        },
        "swipe_03": {
            "start": 24,
            "end": 24.150272108843538,
            "loop": false
        },
        "swipe_04": {
            "start": 26,
            "end": 26.15,
            "loop": false
        },
        "swipe_05": {
            "start": 28,
            "end": 28.15,
            "loop": false
        },
        "tap_01": {
            "start": 30,
            "end": 30.01,
            "loop": false
        },
        "tap_02": {
            "start": 32,
            "end": 32.01,
            "loop": false
        },
        "tap_03": {
            "start": 34,
            "end": 34.01004535147392,
            "loop": false
        },
        "tap_04": {
            "start": 36,
            "end": 36.01002267573696,
            "loop": false
        },
        "tap_05": {
            "start": 38,
            "end": 38.01,
            "loop": false
        },
        "toggle_off": {
            "start": 40,
            "end": 40.09972789115646,
            "loop": false
        },
        "toggle_on": {
            "start": 42,
            "end": 42.09972789115646,
            "loop": false
        },
        "transition_down": {
            "start": 44,
            "end": 44.10018140589569,
            "loop": false
        },
        "transition_up": {
            "start": 46,
            "end": 46.10063492063492,
            "loop": false
        },
        "type_01": {
            "start": 48,
            "end": 48.010068027210885,
            "loop": false
        },
        "type_02": {
            "start": 50,
            "end": 50.01011337868481,
            "loop": false
        },
        "type_03": {
            "start": 52,
            "end": 52.010068027210885,
            "loop": false
        },
        "type_04": {
            "start": 54,
            "end": 54.0102947845805,
            "loop": false
        },
        "type_05": {
            "start": 56,
            "end": 56.01011337868481,
            "loop": false
        }
    }
}

},{}],8:[function(require,module,exports){
module.exports={
    "resources": [
        "./assets/sounds/sprite/02/audioSprite.ogg",
        "./assets/sounds/sprite/02/audioSprite.m4a",
        "./assets/sounds/sprite/02/audioSprite.mp3",
        "./assets/sounds/sprite/02/audioSprite.ac3"
    ],
    "spritemap": {
        "button": {
            "start": 0,
            "end": 0.5513151927437642,
            "loop": false
        },
        "caution": {
            "start": 2,
            "end": 2.499750566893424,
            "loop": false
        },
        "celebration": {
            "start": 4,
            "end": 7.001179138321996,
            "loop": false
        },
        "disabled": {
            "start": 9,
            "end": 9.499115646258504,
            "loop": false
        },
        "notification": {
            "start": 11,
            "end": 14.0037641723356,
            "loop": false
        },
        "progress_loop": {
            "start": 16,
            "end": 17.892199546485262,
            "loop": false
        },
        "ringtone_loop": {
            "start": 19,
            "end": 20.66204081632653,
            "loop": false
        },
        "select": {
            "start": 22,
            "end": 22.26063492063492,
            "loop": false
        },
        "swipe_01": {
            "start": 24,
            "end": 24.209115646258503,
            "loop": false
        },
        "swipe_02": {
            "start": 26,
            "end": 26.230566893424037,
            "loop": false
        },
        "swipe_03": {
            "start": 28,
            "end": 28.230385487528345,
            "loop": false
        },
        "swipe_04": {
            "start": 30,
            "end": 30.23963718820862,
            "loop": false
        },
        "swipe_05": {
            "start": 32,
            "end": 32.196281179138325,
            "loop": false
        },
        "tap_01": {
            "start": 34,
            "end": 34.19621315192744,
            "loop": false
        },
        "tap_02": {
            "start": 36,
            "end": 36.21399092970522,
            "loop": false
        },
        "tap_03": {
            "start": 38,
            "end": 38.2343537414966,
            "loop": false
        },
        "tap_04": {
            "start": 40,
            "end": 40.19183673469388,
            "loop": false
        },
        "tap_05": {
            "start": 42,
            "end": 42.21993197278911,
            "loop": false
        },
        "toggle_off": {
            "start": 44,
            "end": 44.55002267573696,
            "loop": false
        },
        "toggle_on": {
            "start": 46,
            "end": 46.51664399092971,
            "loop": false
        },
        "transition_down": {
            "start": 48,
            "end": 48.7502947845805,
            "loop": false
        },
        "transition_up": {
            "start": 50,
            "end": 50.7502947845805,
            "loop": false
        },
        "type_01": {
            "start": 52,
            "end": 52.50140589569161,
            "loop": false
        },
        "type_02": {
            "start": 54,
            "end": 54.500680272108845,
            "loop": false
        },
        "type_03": {
            "start": 56,
            "end": 56.500090702947844,
            "loop": false
        },
        "type_04": {
            "start": 58,
            "end": 58.500090702947844,
            "loop": false
        },
        "type_05": {
            "start": 60,
            "end": 60.50004535147392,
            "loop": false
        }
    }
}

},{}],9:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const constant_1 = require("./constant");
const soundKit_1 = __importDefault(require("./soundKit"));
const domInteraction_1 = __importDefault(require("./domInteraction"));
const tween_1 = __importDefault(require("./tween"));
const audioSource_1 = __importDefault(require("./audioSource"));
class Snd extends events_1.default {
    constructor(options) {
        super();
        this._soundKit = new soundKit_1.default(constant_1.KITS.SND01);
        this._dom = null;
        this._vol = 1;
        this._isMutedByDeveloper = false;
        this._isMutedByWindow = false;
        this._isWindowBlurred = false;
        this._muteOnWindowBlur = false;
        this._fadeVol = 1;
        this._windowVol = 1;
        this._fadeTweenByDeveloper = null;
        this._fadeTweenByWindowEvent = null;
        this._onVisibilityChange = () => {
            window.document.hidden ? this._onBlur() : this._onFocus();
        };
        this._onBlur = () => {
            if (this._muteOnWindowBlur)
                this._muteOnBlur();
            this._isWindowBlurred = true;
        };
        this._onFocus = () => {
            if (this._muteOnWindowBlur)
                this._unmuteOnFocus();
            this._isWindowBlurred = false;
        };
        this._onInteract = (event) => {
            this.play(event);
        };
        if (typeof window === "undefined")
            return;
        Snd._instances.push(this);
        options = Object.assign(Object.assign({}, Snd._defaultOptions), options);
        this._muteOnWindowBlur = options.muteOnWindowBlur || false;
        if (options === null || options === void 0 ? void 0 : options.easySetup) {
            this._dom = new domInteraction_1.default();
            this._dom.on(domInteraction_1.default.INTERACT, this._onInteract);
        }
        if (options.preloadSoundKit)
            this.load(options.preloadSoundKit);
        const initAudioContext = () => {
            audioSource_1.default.activate();
            window.removeEventListener("click", initAudioContext);
            window.removeEventListener("touchstart", initAudioContext);
        };
        window.addEventListener("click", initAudioContext, { once: true });
        window.addEventListener("touchstart", initAudioContext, { once: true });
        const isSp = navigator.userAgent.match(/iPhone|Android.+Mobile/) != null;
        if (isSp) {
            window.addEventListener("visibilitychange", this._onVisibilityChange);
        }
        else {
            window.addEventListener("blur", this._onBlur);
            window.addEventListener("focus", this._onFocus);
        }
    }
    static get masterVolume() { return this._masterVolume; }
    static set masterVolume(val) {
        this._masterVolume = val;
        this._instances.forEach((instance) => {
            instance._soundKit.masterVolume = this._masterVolume * instance._volume;
        });
    }
    get kit() { return this._soundKit.key; }
    get isMuted() { return this._isMutedByDeveloper || this._isMutedByWindow; }
    get isWindowBlurred() { return this._isWindowBlurred; }
    get _fadeVolume() { return this._fadeVol; }
    set _fadeVolume(val) {
        this._fadeVol = val;
        this._volume = this._fadeVol * this._windowVolume;
    }
    get _windowVolume() { return this._windowVol; }
    set _windowVolume(val) {
        this._windowVol = val;
        this._volume = this._fadeVolume * this._windowVol;
    }
    get _volume() {
        return this._vol;
    }
    set _volume(val) {
        this._vol = val;
        this._soundKit.masterVolume = this._vol * Snd._masterVolume;
    }
    load(soundKitKey) {
        return __awaiter(this, void 0, void 0, function* () {
            this._soundKit.fade(0);
            const oldKey = this._soundKit.key;
            const kit = Snd._initializedSoundKits.get(soundKitKey);
            if (kit === undefined) {
                const newKit = new soundKit_1.default(soundKitKey);
                Snd._initializedSoundKits.set(soundKitKey, newKit);
                yield newKit.load();
                yield newKit.analyze();
                this._soundKit = newKit;
            }
            else {
                this._soundKit = kit;
            }
            this._soundKit.fade(1);
            const crrKey = this._soundKit.key;
            if (oldKey !== crrKey)
                this.emit(Snd.CHANGE_SOUND_KIT, crrKey, oldKey);
        });
    }
    play(soundKey, options = {}) {
        options = Object.assign(Object.assign({}, Snd._defaultPlayOptions), options);
        if (this.isWindowBlurred)
            return;
        if (soundKey === constant_1.SOUNDS.TAP)
            return this.playTap(options);
        if (soundKey === constant_1.SOUNDS.TYPE)
            return this.playType(options);
        if (soundKey === constant_1.SOUNDS.SWIPE)
            return this.playSwipe(options);
        this._soundKit.play(soundKey, options);
    }
    stop(key) {
        this._soundKit.stop(key);
    }
    mute() {
        this._isMutedByDeveloper = true;
        this._fadeByDeveloper(0, 0.3);
    }
    unmute() {
        this._isMutedByDeveloper = false;
        this._fadeByDeveloper(1, 0.3);
    }
    playTap(options = {}) {
        this._playRandom(constant_1.TAP_SOUND_KEYS, options);
    }
    playSwipe(options = {}) {
        this._playRandom(constant_1.SWIPE_SOUND_KEYS, options);
    }
    playType(options = {}) {
        this._playRandom(constant_1.TYPE_SOUND_KEYS, options);
    }
    playButton(options = {}) {
        this.play(Snd.SOUNDS.BUTTON, options);
    }
    playCaution(options = {}) {
        this.play(Snd.SOUNDS.CAUTION, options);
    }
    playCelebration(options = {}) {
        this.play(Snd.SOUNDS.CELEBRATION, options);
    }
    playDisabled(options = {}) {
        this.play(Snd.SOUNDS.DISABLED, options);
    }
    playNotification(options = {}) {
        this.play(Snd.SOUNDS.NOTIFICATION, options);
    }
    playProgressLoop(options = {}) {
        this.play(Snd.SOUNDS.PROGRESS_LOOP, options);
    }
    playRingtoneLoop(options = {}) {
        this.play(Snd.SOUNDS.RINGTONE_LOOP, options);
    }
    playSelect(options = {}) {
        this.play(Snd.SOUNDS.SELECT, options);
    }
    playTransitionUp(options = {}) {
        this.play(Snd.SOUNDS.TRANSITION_UP, options);
    }
    playTransitionDown(options = {}) {
        this.play(Snd.SOUNDS.TRANSITION_DOWN, options);
    }
    playToggleOn(options = {}) {
        this.play(Snd.SOUNDS.TOGGLE_ON, options);
    }
    playToggleOff(options = {}) {
        this.play(Snd.SOUNDS.TOGGLE_OFF, options);
    }
    _playRandom(keys, options = {}) {
        this.play(keys[Math.floor(Math.random() * keys.length)], options);
    }
    _muteOnBlur() {
        this._isMutedByWindow = true;
        this._fadeByWindowEvent(0, 0.3);
    }
    _unmuteOnFocus() {
        this._isMutedByWindow = false;
        this._fadeByWindowEvent(1, 0.3);
    }
    _fadeByDeveloper(volumeTo, duration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._fadeTweenByDeveloper != null)
                this._fadeTweenByDeveloper.kill();
            this._fadeTweenByDeveloper = tween_1.default.to(this, "_fadeVolume", volumeTo, { duration });
        });
    }
    _fadeByWindowEvent(volumeTo, duration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._fadeTweenByWindowEvent != null)
                this._fadeTweenByWindowEvent.kill();
            this._fadeTweenByWindowEvent = tween_1.default.to(this, "_windowVolume", volumeTo, { duration });
        });
    }
}
exports.default = Snd;
Snd.CHANGE_SOUND_KIT = "change_sound_kit";
Snd.SOUNDS = constant_1.SOUNDS;
Snd.KITS = constant_1.KITS;
Snd._instances = [];
Snd._initializedSoundKits = new Map();
Snd._masterVolume = 1;
Snd._defaultOptions = {
    muteOnWindowBlur: true,
    easySetup: false,
    preloadSoundKit: null,
};
Snd._defaultPlayOptions = {
    loop: false,
    volume: 1,
    delay: 0,
    duration: -1,
    callback: () => { }
};

},{"./audioSource":3,"./constant":4,"./domInteraction":5,"./soundKit":10,"./tween":11,"events":1}],10:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const constant_1 = require("./constant");
const audioSource_1 = __importDefault(require("./audioSource"));
class SoundKit {
    constructor(key) {
        this._ids = new Map();
        this._audioSrc = new audioSource_1.default();
        this._masterVolume = 1;
        this.key = key;
    }
    get masterVolume() {
        return this._masterVolume;
    }
    set masterVolume(val) {
        this._masterVolume = val;
        this._audioSrc.masterVolume = this._masterVolume;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            const json = constant_1.KIT_INFO[this.key].json;
            const audioSrc = constant_1.KIT_INFO[this.key].audioSrc;
            try {
                yield this._audioSrc.load(audioSrc, json);
            }
            catch (err) {
                throw err;
            }
        });
    }
    analyze() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this._audioSrc.analyze();
            }
            catch (err) {
                throw err;
            }
        });
    }
    play(key, options) {
        const oldId = this._ids.get(key);
        if (oldId !== undefined)
            this._audioSrc.fade(0, 0.05, oldId);
        const id = this._audioSrc.play(key, options);
        const fadeoutDuration = 0.05;
        if (options.duration > fadeoutDuration) {
            setTimeout(() => {
                this._audioSrc.fade(0, fadeoutDuration, id);
            }, (options.duration - fadeoutDuration) * 1000);
        }
        this._ids.set(key, id);
    }
    stop(soundKey) {
        const id = this._ids.get(soundKey);
        if (id)
            this._audioSrc.stop(id);
        else
            console.warn(`[SoundKit.stop()] key: ${soundKey} haven't played`);
    }
    fade(volTo) {
        this._audioSrc.fadeAll(volTo);
    }
}
exports.default = SoundKit;

},{"./audioSource":3,"./constant":4}],11:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class Tween {
    constructor(target, propName, from, to, type, options) {
        this._propName = "";
        this._to = 0;
        this._from = 0;
        this._duration = 0.5;
        this._delay = 0;
        this._onComplete = () => { };
        this._onUpdate = () => { };
        this._updater = 0;
        this._tween = (from, to) => __awaiter(this, void 0, void 0, function* () {
            if (this._target[this._propName] === undefined)
                return;
            this.kill();
            const startTime = this._time;
            const dur = this._duration;
            const del = this._delay;
            const endTime = startTime + dur + del;
            while (this._time < endTime) {
                if (this._time < startTime + del)
                    continue;
                const crrTime = this._time;
                const percentage = (crrTime - startTime) / (endTime - startTime);
                const val = (to - from) * percentage + from;
                this._target[this._propName] = val;
                this._onUpdate();
                yield new Promise(res => {
                    this._updater = requestAnimationFrame(res);
                });
            }
            this.kill();
            this._target[this._propName] = to;
            this._onUpdate();
            this._onComplete();
        });
        this.kill = () => {
            cancelAnimationFrame(this._updater);
        };
        this._target = target;
        this._propName = propName;
        this._from = from;
        this._to = to;
        options = Object.assign(Object.assign({}, Tween._defaultOptions), options);
        this._duration = options === null || options === void 0 ? void 0 : options.duration;
        this._delay = options === null || options === void 0 ? void 0 : options.delay;
        this._onComplete = options === null || options === void 0 ? void 0 : options.onComplete;
        this._onUpdate = options === null || options === void 0 ? void 0 : options.onUpdate;
        if (this._target[this._propName] !== undefined) {
            switch (type) {
                case "to":
                    this._tweenTo();
                    break;
                case "from":
                    this._tweenFrom();
                    break;
                case "fromTo":
                    this._tweenFromTo();
                    break;
                default:
                    break;
            }
        }
        else {
            throw new Error(`prop: ${this._propName} does not exists in ${this._target}`);
        }
    }
    static to(target, propName, to, options) {
        if (target[propName] === undefined)
            throw new Error(`prop: ${propName} does not exists in ${target}`);
        else
            return new Tween(target, propName, 0, to, "to", options);
    }
    static from(target, propName, from, options) {
        if (target[propName] === undefined)
            throw new Error(`prop: ${propName} does not exists in ${target}`);
        return new Tween(target, propName, from, 0, "from", options);
    }
    static fromTo(target, propName, from, to, options) {
        if (target[propName] === undefined)
            throw new Error(`prop: ${propName} does not exists in ${target}`);
        return new Tween(target, propName, from, to, "fromTo", options);
    }
    get _time() {
        return Date.now() / 1000;
    }
    _tweenTo() {
        const from = this._target[this._propName];
        const to = this._to;
        this._tween(from, to);
    }
    _tweenFrom() {
        const from = this._from;
        const to = this._target[this._propName];
        this._tween(from, to);
    }
    _tweenFromTo() {
        const from = this._from;
        const to = this._to;
        this._tween(from, to);
    }
}
exports.default = Tween;
Tween._defaultOptions = {
    duration: 0.5,
    delay: 0,
    onComplete: () => { },
    onUpdate: () => { }
};

},{}],12:[function(require,module,exports){
"use strict";var _sndLib=_interopRequireDefault(require("snd-lib"));function _interopRequireDefault(t){return t&&t.__esModule?t:{default:t}}function _typeof(t){return(_typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var snd=new _sndLib.default,links=document.querySelectorAll(".js-gNavItem");console.log(links);var onHeaderHover=function(t){snd.play(_sndLib.default.SOUNDS.TAP)};snd.load(_sndLib.default.KITS.SND01).then(function(){for(var t=0;t<links.length;t++)links[t].addEventListener("mouseenter",onHeaderHover)}),window.WebFontConfig={google:{families:["Noto+Sans+JP:400,500,700","Noto+Serif+JP:700","Oswald:400,500,700"]},active:function(){sessionStorage.fonts=!0}},function(){var t=document.createElement("script");t.src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js",t.type="text/javascript",t.async="true";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e)}(),function(){var t=document.querySelector(".js-gNav");t&&t.addEventListener("click",function(){-1===document.body.className.indexOf("is-gNavOpen")?document.body.classList.add("is-gNavOpen"):document.body.classList.remove("is-gNavOpen")});for(var e=0;e<5;e++)document.getElementsByClassName("js-gNavItem")[e].addEventListener("click",function(){document.body.classList.remove("is-gNavOpen")})}(),function(){var e,n,t=document.querySelectorAll(".js-newIcon");t&&(moment.tz.setDefault("Asia/Tokyo"),e=moment().format("YYYY-MM-DD"),n=moment(e).subtract(7,"days").format(),t.forEach(function(t){moment(t.dataset.time).isBetween(n,e,null,"[]")&&t.firstElementChild.classList.add("is-new")}))}(),objectFitImages(".is-object-fit"),function(t,e){function a(t,e){return _typeof(t)===e}function r(t){var e,n=i.className,o=l._config.classPrefix||"";f&&(n=n.baseVal),l._config.enableJSClass&&(e=new RegExp("(^|\\s)"+o+"no-js(\\s|$)"),n=n.replace(e,"$1"+o+"js$2")),l._config.enableClasses&&(n+=" "+o+t.join(" "+o),f?i.className.baseVal=n:i.className=n)}function s(t,e){if("object"==_typeof(t))for(var n in t)h(t,n)&&s(n,t[n]);else{var o=(t=t.toLowerCase()).split("."),i=l[o[0]];if(void 0!==(i=2==o.length?i[o[1]]:i))return l;e="function"==typeof e?e():e,1==o.length?l[o[0]]=e:(!l[o[0]]||l[o[0]]instanceof Boolean||(l[o[0]]=new Boolean(l[o[0]])),l[o[0]][o[1]]=e),r([(e&&0!=e?"":"no-")+o.join("-")]),l._trigger(t,e)}return l}var c=[],u=[],n={_version:"3.6.0",_config:{classPrefix:"",enableClasses:!0,enableJSClass:!0,usePrefixes:!0},_q:[],on:function(t,e){var n=this;setTimeout(function(){e(n[t])},0)},addTest:function(t,e,n){u.push({name:t,fn:e,options:n})},addAsyncTest:function(t){u.push({name:null,fn:t})}};(l=function(){}).prototype=n;var h,o,l=new l,i=e.documentElement,f="svg"===i.nodeName.toLowerCase();h=a(o={}.hasOwnProperty,"undefined")||a(o.call,"undefined")?function(t,e){return e in t&&a(t.constructor.prototype[e],"undefined")}:function(t,e){return o.call(t,e)},n._l={},n.on=function(t,e){this._l[t]||(this._l[t]=[]),this._l[t].push(e),l.hasOwnProperty(t)&&setTimeout(function(){l._trigger(t,l[t])},0)},n._trigger=function(t,e){var n;this._l[t]&&(n=this._l[t],setTimeout(function(){for(var t=0;t<n.length;t++)(0,n[t])(e)},0),delete this._l[t])},l._q.push(function(){n.addTest=s}),l.addAsyncTest(function(){function n(n,t,o){function e(t){var e=!(!t||"load"!==t.type)&&1==i.width;s(n,"webp"===n&&e?new Boolean(e):e),o&&o(t)}var i=new Image;i.onerror=e,i.onload=e,i.src=t}var o=[{uri:"data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",name:"webp"},{uri:"data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==",name:"webp.alpha"},{uri:"data:image/webp;base64,UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA",name:"webp.animation"},{uri:"data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=",name:"webp.lossless"}],t=o.shift();n(t.name,t.uri,function(t){if(t&&"load"===t.type)for(var e=0;e<o.length;e++)n(o[e].name,o[e].uri)})}),function(){var t,e,n,o,i,r,s;for(s in u)if(u.hasOwnProperty(s)){if(t=[],(e=u[s]).name&&(t.push(e.name.toLowerCase()),e.options&&e.options.aliases&&e.options.aliases.length))for(n=0;n<e.options.aliases.length;n++)t.push(e.options.aliases[n].toLowerCase());for(o=a(e.fn,"function")?e.fn():e.fn,i=0;i<t.length;i++)1===(r=t[i].split(".")).length?l[r[0]]=o:(!l[r[0]]||l[r[0]]instanceof Boolean||(l[r[0]]=new Boolean(l[r[0]])),l[r[0]][r[1]]=o),c.push((o?"":"no-")+r.join("-"))}}(),r(c),delete n.addTest,delete n.addAsyncTest;for(var d=0;d<l._q.length;d++)l._q[d]();t.Modernizr=l}(window,document),function(){var f,n,d,p;function r(t){try{return t.defaultView&&t.defaultView.frameElement||null}catch(t){return null}}function u(t){this.time=t.time,this.target=t.target,this.rootBounds=o(t.rootBounds),this.boundingClientRect=o(t.boundingClientRect),this.intersectionRect=o(t.intersectionRect||h()),this.isIntersecting=!!t.intersectionRect;var e=this.boundingClientRect,t=e.width*e.height,e=this.intersectionRect,e=e.width*e.height;this.intersectionRatio=t?Number((e/t).toFixed(4)):this.isIntersecting?1:0}function t(t,e){var n,o,i,e=e||{};if("function"!=typeof t)throw new Error("callback must be a function");if(e.root&&1!=e.root.nodeType&&9!=e.root.nodeType)throw new Error("root must be a Document or Element");this._checkForIntersections=(n=this._checkForIntersections.bind(this),o=this.THROTTLE_TIMEOUT,i=null,function(){i=i||setTimeout(function(){n(),i=null},o)}),this._callback=t,this._observationTargets=[],this._queuedEntries=[],this._rootMarginValues=this._parseRootMargin(e.rootMargin),this.thresholds=this._initThresholds(e.threshold),this.root=e.root||null,this.rootMargin=this._rootMarginValues.map(function(t){return t.value+t.unit}).join(" "),this._monitoringDocuments=[],this._monitoringUnsubscribes=[]}function s(t,e,n,o){"function"==typeof t.addEventListener?t.addEventListener(e,n,o||!1):"function"==typeof t.attachEvent&&t.attachEvent("on"+e,n)}function a(t,e,n,o){"function"==typeof t.removeEventListener?t.removeEventListener(e,n,o||!1):"function"==typeof t.detatchEvent&&t.detatchEvent("on"+e,n)}function m(t){var e;try{e=t.getBoundingClientRect()}catch(t){}return e?e.width&&e.height?e:{top:e.top,right:e.right,bottom:e.bottom,left:e.left,width:e.right-e.left,height:e.bottom-e.top}:h()}function h(){return{top:0,bottom:0,left:0,right:0,width:0,height:0}}function o(t){return!t||"x"in t?t:{top:t.top,y:t.top,bottom:t.bottom,left:t.left,x:t.left,right:t.right,width:t.width,height:t.height}}function g(t,e){var n=e.top-t.top,t=e.left-t.left;return{top:n,left:t,height:e.height,width:e.width,bottom:n+e.height,right:t+e.width}}function i(t,e){for(var n=e;n;){if(n==t)return!0;n=A(n)}return!1}function A(t){var e=t.parentNode;return 9==t.nodeType&&t!=f?r(t):(e=e&&e.assignedSlot?e.assignedSlot.parentNode:e)&&11==e.nodeType&&e.host?e.host:e}function c(t){return t&&9===t.nodeType}"object"===("undefined"==typeof window?"undefined":_typeof(window))&&("IntersectionObserver"in window&&"IntersectionObserverEntry"in window&&"intersectionRatio"in window.IntersectionObserverEntry.prototype?"isIntersecting"in window.IntersectionObserverEntry.prototype||Object.defineProperty(window.IntersectionObserverEntry.prototype,"isIntersecting",{get:function(){return 0<this.intersectionRatio}}):(f=function(){for(var t=window.document,e=r(t);e;)e=r(t=e.ownerDocument);return t}(),n=[],p=d=null,t.prototype.THROTTLE_TIMEOUT=100,t.prototype.POLL_INTERVAL=null,t.prototype.USE_MUTATION_OBSERVER=!0,t._setupCrossOriginUpdater=function(){return d=d||function(t,e){p=t&&e?g(t,e):h(),n.forEach(function(t){t._checkForIntersections()})}},t._resetCrossOriginUpdater=function(){p=d=null},t.prototype.observe=function(e){if(!this._observationTargets.some(function(t){return t.element==e})){if(!e||1!=e.nodeType)throw new Error("target must be an Element");this._registerInstance(),this._observationTargets.push({element:e,entry:null}),this._monitorIntersections(e.ownerDocument),this._checkForIntersections()}},t.prototype.unobserve=function(e){this._observationTargets=this._observationTargets.filter(function(t){return t.element!=e}),this._unmonitorIntersections(e.ownerDocument),0==this._observationTargets.length&&this._unregisterInstance()},t.prototype.disconnect=function(){this._observationTargets=[],this._unmonitorAllIntersections(),this._unregisterInstance()},t.prototype.takeRecords=function(){var t=this._queuedEntries.slice();return this._queuedEntries=[],t},t.prototype._initThresholds=function(t){t=t||[0];return(t=!Array.isArray(t)?[t]:t).sort().filter(function(t,e,n){if("number"!=typeof t||isNaN(t)||t<0||1<t)throw new Error("threshold must be a number between 0 and 1 inclusively");return t!==n[e-1]})},t.prototype._parseRootMargin=function(t){t=(t||"0px").split(/\s+/).map(function(t){t=/^(-?\d*\.?\d+)(px|%)$/.exec(t);if(!t)throw new Error("rootMargin must be specified in pixels or percent");return{value:parseFloat(t[1]),unit:t[2]}});return t[1]=t[1]||t[0],t[2]=t[2]||t[0],t[3]=t[3]||t[1],t},t.prototype._monitorIntersections=function(e){var n,o,i,t=e.defaultView;t&&-1==this._monitoringDocuments.indexOf(e)&&(n=this._checkForIntersections,i=o=null,this.POLL_INTERVAL?o=t.setInterval(n,this.POLL_INTERVAL):(s(t,"resize",n,!0),s(e,"scroll",n,!0),this.USE_MUTATION_OBSERVER&&"MutationObserver"in t&&(i=new t.MutationObserver(n)).observe(e,{attributes:!0,childList:!0,characterData:!0,subtree:!0})),this._monitoringDocuments.push(e),this._monitoringUnsubscribes.push(function(){var t=e.defaultView;t&&(o&&t.clearInterval(o),a(t,"resize",n,!0)),a(e,"scroll",n,!0),i&&i.disconnect()}),t=this.root&&(this.root.ownerDocument||this.root)||f,e==t||(t=r(e))&&this._monitorIntersections(t.ownerDocument))},t.prototype._unmonitorIntersections=function(o){var i,t,e=this._monitoringDocuments.indexOf(o);-1!=e&&(i=this.root&&(this.root.ownerDocument||this.root)||f,this._observationTargets.some(function(t){if((e=t.element.ownerDocument)==o)return!0;for(;e&&e!=i;){var e,n=r(e);if((e=n&&n.ownerDocument)==o)return!0}return!1})||(t=this._monitoringUnsubscribes[e],this._monitoringDocuments.splice(e,1),this._monitoringUnsubscribes.splice(e,1),t(),o==i||(t=r(o))&&this._unmonitorIntersections(t.ownerDocument)))},t.prototype._unmonitorAllIntersections=function(){var t=this._monitoringUnsubscribes.slice(0);this._monitoringDocuments.length=0;for(var e=this._monitoringUnsubscribes.length=0;e<t.length;e++)t[e]()},t.prototype._checkForIntersections=function(){var a,c;!this.root&&d&&!p||(a=this._rootIsInDom(),c=a?this._getRootRect():h(),this._observationTargets.forEach(function(t){var e=t.element,n=m(e),o=this._rootContainsTarget(e),i=t.entry,r=a&&o&&this._computeTargetAndRootIntersection(e,n,c),s=null;this._rootContainsTarget(e)?d&&!this.root||(s=c):s=h();r=t.entry=new u({time:window.performance&&performance.now&&performance.now(),target:e,boundingClientRect:n,rootBounds:s,intersectionRect:r});i?a&&o?this._hasCrossedThreshold(i,r)&&this._queuedEntries.push(r):i&&i.isIntersecting&&this._queuedEntries.push(r):this._queuedEntries.push(r)},this),this._queuedEntries.length&&this._callback(this.takeRecords(),this))},t.prototype._computeTargetAndRootIntersection=function(t,e,n){if("none"!=window.getComputedStyle(t).display){for(var o=e,i=A(t),r=!1;!r&&i;){var s,a,c,u,h=null,l=1==i.nodeType?window.getComputedStyle(i):{};if("none"==l.display)return null;if(i==this.root||9==i.nodeType?(r=!0,i==this.root||i==f?d&&!this.root?!p||0==p.width&&0==p.height?o=h=i=null:h=p:h=n:(a=(s=A(i))&&m(s),c=s&&this._computeTargetAndRootIntersection(s,a,n),a&&c?(i=s,h=g(a,c)):o=i=null)):i!=(u=i.ownerDocument).body&&i!=u.documentElement&&"visible"!=l.overflow&&(h=m(i)),h&&(s=h,a=o,h=l=u=c=void 0,c=Math.max(s.top,a.top),u=Math.min(s.bottom,a.bottom),l=Math.max(s.left,a.left),h=Math.min(s.right,a.right),a=u-c,o=0<=(s=h-l)&&0<=a?{top:c,bottom:u,left:l,right:h,width:s,height:a}:null),!o)break;i=i&&A(i)}return o}},t.prototype._getRootRect=function(){var t,e;return e=this.root&&!c(this.root)?m(this.root):(t=(e=c(this.root)?this.root:f).documentElement,e=e.body,{top:0,left:0,right:t.clientWidth||e.clientWidth,width:t.clientWidth||e.clientWidth,bottom:t.clientHeight||e.clientHeight,height:t.clientHeight||e.clientHeight}),this._expandRectByRootMargin(e)},t.prototype._expandRectByRootMargin=function(n){var t=this._rootMarginValues.map(function(t,e){return"px"==t.unit?t.value:t.value*(e%2?n.width:n.height)/100}),t={top:n.top-t[0],right:n.right+t[1],bottom:n.bottom+t[2],left:n.left-t[3]};return t.width=t.right-t.left,t.height=t.bottom-t.top,t},t.prototype._hasCrossedThreshold=function(t,e){var n=t&&t.isIntersecting?t.intersectionRatio||0:-1,o=e.isIntersecting?e.intersectionRatio||0:-1;if(n!==o)for(var i=0;i<this.thresholds.length;i++){var r=this.thresholds[i];if(r==n||r==o||r<n!=r<o)return!0}},t.prototype._rootIsInDom=function(){return!this.root||i(f,this.root)},t.prototype._rootContainsTarget=function(t){var e=this.root&&(this.root.ownerDocument||this.root)||f;return i(e,t)&&(!this.root||e==t.ownerDocument)},t.prototype._registerInstance=function(){n.indexOf(this)<0&&n.push(this)},t.prototype._unregisterInstance=function(){var t=n.indexOf(this);-1!=t&&n.splice(t,1)},window.IntersectionObserver=t,window.IntersectionObserverEntry=u))}(),function(){var e,t=document.querySelectorAll(".js-fadeIn");t&&(e=new IntersectionObserver(function(t){t.forEach(function(t){t.isIntersecting&&t.target.classList.add("is-fadeIn")})},{root:null,rootMargin:"-10% 0px",threshold:0}),t.forEach(function(t){e.observe(t)}));var n,t=document.querySelectorAll(".js-flash");t&&(n=new IntersectionObserver(function(t){t.forEach(function(t){t.isIntersecting&&t.target.classList.add("is-flash")})},{root:null,rootMargin:"-30% 0px",threshold:0}),t.forEach(function(t){n.observe(t)}))}();
},{"snd-lib":6}]},{},[12]);
