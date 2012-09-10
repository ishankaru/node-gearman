// Generated by CoffeeScript 1.3.3

/*

based on protocol doc: http://gearman.org/index.php?id=protocol
*/


(function() {
  'use strict';

  var EventEmitter, Gearman, binary, nb, net, packet_types, put, req, req_magic, res_magic, utillib;

  binary = require('binary');

  put = require('put');

  net = require('net');

  EventEmitter = require('events').EventEmitter;

  utillib = require('util');

  nb = new Buffer([0]);

  req = new Buffer('REQ', 'ascii');

  req_magic = new Buffer([0x00, 0x52, 0x45, 0x51]);

  res_magic = new Buffer([0, 0x52, 0x45, 0x53]);

  packet_types = {
    CAN_DO: 1,
    CANT_DO: 2,
    RESET_ABILITIES: 3,
    PRE_SLEEP: 4,
    NOOP: 6,
    SUBMIT_JOB: 7,
    JOB_CREATED: 8,
    GRAB_JOB: 9,
    NO_JOB: 10,
    JOB_ASSIGN: 11,
    WORK_STATUS: 12,
    WORK_COMPLETE: 13,
    WORK_FAIL: 14,
    GET_STATUS: 15,
    ECHO_REQ: 16,
    ECHO_RES: 17,
    SUBMIT_JOB_BG: 18,
    ERROR: 19,
    STATUS_RES: 20,
    SUBMIT_JOB_HIGH: 21,
    SET_CLIENT_ID: 22,
    CAN_DO_TIMEOUT: 23,
    ALL_YOURS: 24,
    WORK_EXCEPTION: 25,
    OPTION_REQ: 26,
    OPTION_RES: 27,
    WORK_DATA: 28,
    WORK_WARNING: 29,
    GRAB_JOB_UNIQ: 30,
    SUBMIT_JOB_HIGH_BG: 32,
    SUBMIT_JOB_LOW: 33,
    SUBMIT_JOB_LOW_BG: 34,
    SUBMIT_JOB_SCHED: 35,
    SUBMIT_JOB_EPOCH: 36
  };

  Gearman = (function() {

    function Gearman(host, port) {
      var _this = this;
      this.host = host != null ? host : '127.0.0.1';
      this.port = port != null ? port : 4730;
      this._worker_id = null;
      this._connected = false;
      this._conn = new net.Socket();
      this._conn.on('data', function(chunk) {
        return _this._handlePacket(_this._decodePacket(chunk));
      });
      this._conn.on('error', function(error) {
        return console.log('error', error);
      });
      this._conn.on('close', function(had_transmission_error) {
        return console.log('socket closed');
      });
      this._conn.on('timeout', function() {
        return console.log('socket timed out');
      });
    }

    utillib.inherits(Gearman, EventEmitter);

    Gearman.prototype.close = function() {
      if (this._connected) {
        return this._conn.end();
      }
    };

    Gearman.prototype.connect = function(callback) {
      var _this = this;
      this._connected = true;
      return this._conn.connect(this.port, this.host, function() {
        return callback();
      });
    };

    Gearman.prototype.echo = function(payload) {
      var echo;
      echo = this._encodePacket(packet_types.ECHO_REQ, payload);
      return this._send(echo);
    };

    Gearman.prototype.getJobStatus = function(handle) {
      return this._sendPacketS(packet_types.GET_STATUS, handle);
    };

    Gearman.prototype.setOption = function(optionName) {
      if (optionName == null) {
        optionName = 'exceptions';
      }
      if (optionName !== 'exceptions') {
        throw new Error('unsupported option');
      }
      return this._sendPacketS(packet_types.OPTION_REQ, optionName);
    };

    Gearman.prototype.submitJob = function(func_name, data, options) {
      var job, lookup_table, packet_type, payload, sig;
      if (data == null) {
        data = null;
      }
      if (options == null) {
        options = {};
      }
      if (typeof func_name !== 'string') {
        throw new Error('function name must be a string');
      }
      lookup_table = {
        'lowtrue': packet_types.SUBMIT_JOB_LOW_BG,
        'lowfalse': packet_types.SUBMIT_JOB_LOW,
        'normaltrue': packet_types.SUBMIT_JOB_BG,
        'normalfalse': packet_types.SUBMIT_JOB,
        'hightrue': packet_types.SUBMIT_JOB_HIGH_BG,
        'highfalse': packet_types.SUBMIT_JOB_HIGH
      };
      if (!options.unique_id) {
        options.unique_id = this._uniqueId();
      }
      if (!options.background) {
        options.background = false;
      }
      if (!options.priority) {
        options.priority = 'normal';
      }
      if (!options.encoding) {
        options.encoding = null;
      }
      if (!data) {
        data = new Buffer();
      }
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data, options.encoding);
      }
      options.background += '';
      sig = options.priority.trim().toLowerCase() + options.background.trim().toLowerCase();
      packet_type = lookup_table[sig];
      if (!packet_type) {
        throw new Error('invalid background or priority setting');
      }
      payload = put().put(new Buffer(func_name, 'ascii')).word8(0).put(new Buffer(options.unique_id, 'ascii')).word8(0).put(data).buffer();
      job = this._encodePacket(packet_type, payload, options.encoding);
      return this._send(job, options.encoding);
    };

    Gearman.prototype.addFunction = function(func_name, timeout) {
      var job, payload;
      if (timeout == null) {
        timeout = 0;
      }
      if (typeof func_name !== 'string') {
        throw new Error('function name must be a string');
      }
      if (typeof timeout !== 'number') {
        throw new Error('timout must be an int');
      }
      if (timeout < 0) {
        throw new Error('timeout must be greater than zero');
      }
      if (timeout === 0) {
        job = this._encodePacket(packet_types.CAN_DO, func_name);
      } else {
        payload = put().put(new Buffer(func_name, 'utf-8')).word8(0).word32be(timeout).buffer();
        job = this._encodePacket(packet_types.CAN_DO_TIMEOUT, payload);
      }
      return this._send(job);
    };

    Gearman.prototype.removeFunction = function(func_name) {
      return this._sendPacketS(packet_types.CANT_DO, func_name);
    };

    Gearman.prototype.resetAbilities = function() {
      var job;
      job = this._encodePacket(packet_types.RESET_ABILITIES, '', 'ascii');
      return this._send(job, 'ascii');
    };

    Gearman.prototype.preSleep = function() {
      var job;
      job = this._encodePacket(packet_types.PRE_SLEEP);
      return this._send(job, 'ascii');
    };

    Gearman.prototype.grabJob = function() {
      var job;
      job = this._encodePacket(packet_types.GRAB_JOB);
      return this._send(job, 'ascii');
    };

    Gearman.prototype.grabUniqueJob = function() {
      var job;
      job = this._encodePacket(packet_types.GRAB_JOB_UNIQ, '', 'ascii');
      return this._send(job, 'ascii');
    };

    Gearman.prototype.sendWorkStatus = function(job_handle, percent_numerator, percent_denominator) {
      var job, payload;
      payload = put().put(new Buffer(job_handle, 'ascii')).word8(0).put(new Buffer(percent_numerator, 'ascii')).word8(0).put(new Buffer(percent_denominator, 'ascii')).buffer();
      job = this._encodePacket(packet_types.WORK_STATUS, payload);
      return this._send(job);
    };

    Gearman.prototype.sendWorkFail = function(job_handle) {
      return this._sendPacketS(packet_types.WORK_FAIL, job_handle);
    };

    Gearman.prototype.sendWorkComplete = function(job_handle, data) {
      return this._sendPacketSB(packet_types.WORK_COMPLETE, job_handle, data);
    };

    Gearman.prototype.sendWorkData = function(job_handle, data) {
      return this._sendPacketSB(packet_types.WORK_DATA, job_handle, data);
    };

    Gearman.prototype.sendWorkException = function(job_handle, exception) {
      return this._sendPacketSB(packet_types.WORK_EXCEPTION, job_handle, exception);
    };

    Gearman.prototype.sendWorkWarning = function(job_handle, warning) {
      return this._sendPacketSB(packet_types.WORK_WARNING, job_handle, warning);
    };

    Gearman.prototype.setWorkerId = function(id) {
      this._sendPacketS(packet_types.SET_CLIENT_ID, id);
      return this._worker_id = id;
    };

    Gearman.prototype._decodePacket = function(buf) {
      var o, size;
      if (!Buffer.isBuffer(buf)) {
        throw new Error('argument must be a buffer');
      }
      size = 0;
      o = binary.parse(buf).word32bu('reqType').word32bu('type').word32bu('size').tap(function(vars) {
        return size = vars.size;
      }).buffer('inputData', size).vars;
      if ((o.reqType !== binary.parse(res_magic).word32bu('reqType').vars.reqType) && (o.reqType !== binary.parse(req_magic).word32bu('reqType').vars.reqType)) {
        throw new Error('invalid request header');
      }
      if (o.type < 1 || o.type > 36) {
        throw new Error('invalid packet type');
      }
      if (o.size !== o.inputData.length) {
        throw new Error('invalid packet size, mismatches data length');
      }
      delete o.reqType;
      return o;
    };

    Gearman.prototype._encodePacket = function(type, data, encoding) {
      var len;
      if (data == null) {
        data = null;
      }
      if (encoding == null) {
        encoding = null;
      }
      if (!(data != null)) {
        data = new Buffer(0);
      }
      len = data.length;
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data, encoding);
      }
      if (type < 1 || type > 36) {
        throw new Error('invalid packet type');
      }
      return put().word8(0).put(req).word32be(type).word32be(len).put(data).buffer();
    };

    Gearman.prototype._handlePacket = function(packet) {
      var job_handle, p, result;
      if (packet.type === packet_types.ECHO_RES) {
        result = this._parsePacket(packet.inputData, 'B');
        this.emit('ECHO_RES', result[0]);
        return;
      }
      if (packet.type === packet_types.JOB_CREATED) {
        job_handle = packet.inputData.toString();
        this.emit('JOB_CREATED', job_handle);
        return;
      }
      if (packet.type === packet_types.ERROR) {
        result = this._parsePacket(packet.inputData, 'ss');
        this.emit('ERROR', result[0], result[1]);
        return;
      }
      if (packet.type === packet_types.STATUS_RES) {
        result = this._parsePacket(packet.inputData, 'ssss8');
        result = {
          handle: result[0],
          known: result[1],
          running: result[2],
          percent_done_num: result[3],
          percent_done_den: result[4]
        };
        this.emit('STATUS_RES', result);
        return;
      }
      if (packet.type === packet_types.WORK_COMPLETE) {
        result = this._parsePacket(packet.inputData, 'sb');
        this.emit('WORK_COMPLETE', {
          handle: result[0],
          payload: result[1]
        });
        return;
      }
      if (packet.type === packet_types.WORK_DATA) {
        result = this._parsePacket(packet.inputData, 'sb');
        this.emit('WORK_DATA', {
          handle: result[0],
          payload: result[1]
        });
        return;
      }
      if (packet.type === packet_types.WORK_EXCEPTION) {
        result = this._parsePacket(packet.inputData, 'ss');
        this.emit('WORK_EXCEPTION', {
          handle: result[0],
          exception: result[1]
        });
        return;
      }
      if (packet.type === packet_types.WORK_WARNING) {
        result = this._parsePacket(packet.inputData, 'ss');
        this.emit('WORK_WARNING', {
          handle: result[0],
          warning: result[1]
        });
        return;
      }
      if (packet.type === packet_types.WORK_STATUS) {
        result = this._parsePacket(packet.inputData, 'sss');
        this.emit('WORK_STATUS', {
          handle: result[0],
          percent_num: result[1],
          percent_den: result[2]
        });
        return;
      }
      if (packet.type === packet_types.WORK_FAIL) {
        result = this._parsePacket(packet.inputData, 's');
        this.emit('WORK_FAIL', {
          handle: result[0]
        });
        return;
      }
      if (packet.type === packet_types.OPTION_RES) {
        result = this._parsePacket(packet.inputData, 's');
        this.emit('OPTION_RES', {
          option_name: result[0]
        });
        return;
      }
      if (packet.type === packet_types.NO_JOB) {
        this.emit('NO_JOB');
        return;
      }
      if (packet.type === packet_types.JOB_ASSIGN) {
        result = this._parsePacket(packet.inputData, 'ssB');
        this.emit('JOB_ASSIGN', {
          handle: result[0],
          func_name: result[1],
          payload: result[2]
        });
        return;
      }
      if (packet.type === packet_types.JOB_ASSIGN_UNIQ) {
        p = this._parsePacket(packet.inputData, 'sssB');
        this.emit('JOB_ASSIGN_UNIQ', {
          handle: p[0],
          func_name: p[1],
          unique_id: p[2],
          payload: p[3]
        });
        return;
      }
      if (packet.type === packet_types.NOOP) {
        return this.emit('NOOP');
      }
    };

    Gearman.prototype._parsePacket = function(packet, format_string) {
      var b, c, i, key, len;
      format_string = format_string.toUpperCase();
      b = binary.parse(packet);
      len = 0;
      i = 0;
      while (i < (format_string.length - 1)) {
        key = '' + i;
        c = format_string.charAt(i);
        if (c === 'S') {
          b.scan(key, nb);
          len += b.vars[key].length + 1;
          b.vars[key] = b.vars[key].toString();
        }
        if (c === 'B') {
          b.scan(key, nb);
          len += b.vars[key].length + 1;
        }
        if (c === '8') {
          b.word8be(key);
          len++;
        }
        i++;
      }
      if (format_string.length > 0) {
        i = format_string.length - 1;
        c = format_string.charAt(i);
        if (c === '8') {
          b.word8be('' + i);
        } else {
          b.buffer('' + i, packet.length - len);
          if (c === 'S') {
            b.vars['' + i] = b.vars['' + i].toString();
          }
        }
      }
      return b.vars;
    };

    Gearman.prototype._send = function(data, encoding) {
      if (encoding == null) {
        encoding = null;
      }
      if (!this._connected) {
        throw new Error('Cannot send packets before connecting. Please connect first.');
      }
      return this._conn.write(data, encoding);
    };

    Gearman.prototype._sendPacketS = function(packet_type, str) {
      var job, payload;
      if (typeof str !== 'string') {
        throw new Error('parameter 1 must be a string');
      }
      payload = put().put(new Buffer(str, 'ascii')).buffer();
      job = this._encodePacket(packet_type, payload);
      return this._send(job);
    };

    Gearman.prototype._sendPacketSB = function(packet_type, str, buf) {
      var job, payload;
      if (!Buffer.isBuffer(buf)) {
        buf = new Buffer(buf, 'utf8');
      }
      payload = put().put(new Buffer(str, 'ascii')).word8(0).put(buf).buffer();
      job = this._encodePacket(packet_type, payload);
      return this._send(job);
    };

    Gearman.prototype._uniqueId = function(length) {
      var id;
      if (length == null) {
        length = 12;
      }
      id = "";
      while (id.length < length) {
        id += Math.random().toString(36).substr(2);
      }
      return id.substr(0, length);
    };

    return Gearman;

  })();

  module.exports.Gearman = Gearman;

  module.exports.packet_types = packet_types;

}).call(this);
