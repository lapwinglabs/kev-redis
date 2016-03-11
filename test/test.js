var Kev = require('kev')
var test_core = require('kev/test/test-plugin-core')
var test_ttl = require('kev/test/test-ttl')
var KevRedis = require('../index.js')
var Promise = require('bluebird')
var assert = require('assert')

var core = Promise.promisifyAll(KevRedis({ port: process.env.REDIS_PORT }))
var ttl = Promise.promisifyAll(KevRedis({ port: process.env.REDIS_PORT, ttl: 5 }))
var compressed = Promise.promisifyAll(KevRedis({ port: process.env.REDIS_PORT, compress: true }))
var tags = Promise.promisifyAll(Kev({ store: KevRedis({ port: process.env.REDIS_PORT, prefix: 'tags' }) }))
var raw = Promise.promisifyAll(Kev({ store: KevRedis({ port: process.env.REDIS_PORT, compress: true }) }))
var gzip = Promise.promisifyAll(Kev({ store: KevRedis({ port: process.env.REDIS_PORT, compress: { type: 'gzip' } }) }))
var resurrectZip = Promise.promisifyAll(Kev({ store: KevRedis({ port: process.env.REDIS_PORT, compress: { type: 'gzip' }, restoreTypes: { resurrect: true } }) }))
var resurrect = Promise.promisifyAll(Kev({ store: KevRedis({ port: process.env.REDIS_PORT, restoreTypes: { resurrect: true } }) }))
var customPack = Promise.promisifyAll(Kev({ store: KevRedis({ port: process.env.REDIS_PORT, restoreTypes: { pack: (v) => 'stored', unpack: (v) => 'retrieved' } }) }))

Promise.resolve()
  .then(() => test_core(core))
  .then(() => test_ttl(ttl))
  .then(() => test_core(compressed))
  .then(() => console.log('COMPRESSION PASSED'))
  .then(() => {
    return tags.putAsync('tagged', 'value')
      .then(() => tags.tagAsync('tagged', ['drop', 'pord']))
      .then(() => tags.putAsync('other', 'value'))
      .then(() => tags.tagAsync('other', 'pord'))
      .then(() => tags.store.storage.smembersAsync('tags:_tagKeys:drop'))
      .then((keys) => assert.deepEqual(keys, ['tags:tagged']))
      .then(() => tags.store.storage.smembersAsync('tags:_tagKeys:pord'))
      .then((keys) => assert.deepEqual(keys.sort(), ['tags:tagged', 'tags:other'].sort()))
      .then(() => tags.store.storage.smembersAsync('tags:_keyTags:tagged'))
      .then((keys) => assert.deepEqual(keys.sort(), ['drop', 'pord'].sort()))
      .then(() => tags.dropTagAsync('drop'))
      .then(() => tags.store.storage.smembersAsync('tags:_tagKeys:drop'))
      .then((keys) => assert.deepEqual(keys, []))
      .then(() => tags.store.storage.smembersAsync('tags:_tagKeys:pord'))
      .then((keys) => assert.deepEqual(keys, ['tags:other']))
      .then(() => tags.store.storage.smembersAsync('tags:_keyTags:tagged'))
      .then((keys) => assert.deepEqual(keys, []))
      .then(() => tags.dropAsync('*'))
      .then(() => tags.closeAsync())
      .then(() => console.log('TAGS PASSED'))
  })
  .then(() => {
    // verify raw retrieval support
    return raw.putAsync('tagged', 'hello world')
      .then(() => raw.getAsync('tagged'))
      .then((value) => assert.equal(value, 'hello world'))
      .then(() => raw.getAsync('tagged', { compress: { raw: true } }))
      .then((value) => assert.equal(value, 'eJxTykjNyclXKM8vyklRAgAgRQSh'))
      .then(() => raw.dropAsync('*'))
      .then(() => raw.closeAsync())
      .then(() => console.log('RAW RETRIEVAL PASSED'))
  }).then(() => {
    // verify gzip compression support
    return gzip.putAsync('tagged', 'hello world')
      .then(() => gzip.getAsync('tagged'))
      .then((value) => assert.equal(value, 'hello world'))
      .then(() => gzip.getAsync('tagged', { compress: { raw: true } }))
      .then((value) => assert.equal(value, 'H4sIAAAAAAAAA1PKSM3JyVcozy/KSVECAITtPj0NAAAA'))
      .then(() => gzip.dropAsync('*'))
      .then(() => gzip.closeAsync())
      .then(() => console.log('GZIP PASSED'))
  })
  .then(() => {
    // verify resurrect support with compression
    return resurrectZip.putAsync('date', new Date(Date.now()))
      .then(() => resurrectZip.getAsync('date'))
      .then((value) => assert.ok(value instanceof Date))
      .then(() => resurrectZip.putAsync('regex', /xyz/))
      .then(() => resurrectZip.getAsync('regex'))
      .then((value) => assert.ok(value instanceof RegExp))
      .then(() => resurrectZip.dropAsync('*'))
      .then(() => resurrectZip.closeAsync())
      .then(() => console.log('COMPRESSED RESURRECT PASSED'))
  })
  .then(() => {
    // verify resurrect support without compression
    return resurrect.putAsync('date', new Date(Date.now()))
      .then(() => resurrect.getAsync('date'))
      .then((value) => assert.ok(value instanceof Date))
      .then(() => resurrect.putAsync('regex', /xyz/))
      .then(() => resurrect.getAsync('regex'))
      .then((value) => assert.ok(value instanceof RegExp))
      .then(() => resurrect.dropAsync('*'))
      .then(() => resurrect.closeAsync())
      .then(() => console.log('UNCOMPRESSED RESURRECT PASSED'))
  })
  .then(() => {
    // verify custom packing without compress
    return customPack.putAsync('data', { hi: 'there' })
      .then(() => customPack.store.storage)
      .then(() => customPack.store.storage.getAsync('kev:data'))
      .then((val) => assert.equal(val, 'stored'))
      .then(() => customPack.getAsync('data'))
      .then((val) => assert.equal(val, 'retrieved'))
      .then(() => customPack.dropAsync('*'))
      .then(() => customPack.closeAsync())
      .then(() => console.log('CUSTOM RESTORE PASSED'))
  })
