var Promise = require('bluebird')
var seconds = require('juration').parse
var resurrect = require('./resurrect')()
var zlib = require('zlib')

var Redis = require('redis')
Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

var KevRedis = module.exports = function KevRedis (options) {
  if (!(this instanceof KevRedis)) return new KevRedis(options)

  options = options || {}
  options.port = options.port || 6379
  options.host = options.host || '127.0.0.1'
  options.compress = options.compress || false
  var client = Redis.createClient(options.port, options.host, options)

  if (options.ttl) options.ttl = seconds(String(options.ttl))
  if (options.prefix) options.prefix = options.prefix + ':'
  else options.prefix = ''
  this.options = options

  this.pendingOps = []
  client.on('connect', () => {
    this.storage = client;
    for (var index in this.pendingOps) {
      this.pendingOps[index]()
    }
  })
}

KevRedis.prototype.get = function (keys, done) {
  if (!this.storage) return this.pendingOps.push(this.get.bind(this, keys, done))
  keys = keys.map((k) => this.options.prefix + k)
  this.storage.mgetAsync(keys)
    .reduce((out, v, idx) => { out[keys[idx]] = unpack(this.options.compress)(v); return out }, {})
    .props()
    .then((out) => done && done(null, out))
    .catch((err) => done && done(err))
}

KevRedis.prototype.put = function (keys, options, done) {
  if (!this.storage) return this.pendingOps.push(this.put.bind(this, keys, options, done))

  var ttl = options.ttl || this.options.ttl
  for (var key in keys) {
    key = this.options.prefix + key
    keys[key] = pack(this.options.compress)(keys[key])
      .then((v) => this.storage.getsetAsync(key, v))
      .tap((v) => ttl && this.storage.expire(key, ttl))
      .then(unpack(this.options.compress))
  }

  Promise.props(keys)
    .then((v) => done && done(null, v))
    .catch((err) => done && done(err))
}

KevRedis.prototype.del = function (keys, done) {
  keys = keys.map((k) => this.options.prefix + k)
  if (!this.storage) return this.pendingOps.push(this.del.bind(this, keys, done))

  this.storage.multi().mget(keys).del(keys).execAsync()
    .then((out) => out[0])
    .reduce((p, c, i) => { p[keys[i]] = unpack(this.options.compress)(c); return p }, {})
    .props()
    .then((v) => done && done(null, v))
    .catch((e) => done && done(e))
}

KevRedis.prototype.drop = function (pattern, done) {
  pattern = this.options.prefix + pattern
  if (!this.storage) return this.pendingOps.push(this.drop.bind(this, pattern, done))
  this.storage.evalAsync(
    `local keys = redis.call('keys', '${pattern}') \n` +
    `for i=1,#keys,5000 do \n` +
    `  redis.call('del', unpack(keys, i, math.min(i+4999, #keys))) \n` +
    `end \n` +
    `return keys`
  , 0)
  .then((keys) => done && done(null, keys.length))
  .catch((e) => done && done(null, err))
}

KevRedis.prototype.close = function (done) {
  if (!this.storage) return this.pendingOps.push(this.close.bind(this, done))
  if (!this.storage.connected) { return process.nextTick(done) }
  this.storage.once('end', done || function() {})
  this.storage.quit()
}

function pack (compress) {
  return Promise.promisify((value, done) => {
    if (!value) return setImmediate(done)
    if (!compress) {
      setImmediate(() => done(null, resurrect.stringify(value)))
    } else {
      zlib.deflate(resurrect.stringify(value), compress, (err, buf) => {
        if (err) done(err)
        else done(null, buf.toString('base64'))
      })
    }
  })
}

function unpack (compress) {
  return Promise.promisify((value, done) => {
    if (!value) return setImmediate(done)
    if (!compress) {
      setImmediate(() => done(null, resurrect.resurrect(value)))
    } else {
      zlib.inflate(new Buffer(value, 'base64'), compress, (err, val) => {
        if (err) done(err)
        else done(null, resurrect.resurrect(val.toString()))
      })
    }
  })
}
