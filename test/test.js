var Kev = require('kev')
var test_core = require('kev/test/test-plugin-core')
var test_ttl = require('kev/test/test-ttl')
var KevRedis = require('../index.js')
var Promise = require('bluebird')
var assert = require('assert')

var core = KevRedis({
  port: process.env.REDIS_PORT,
  ttl: 5
})

var compressed = KevRedis({
  port: process.env.REDIS_PORT,
  ttl: 5,
  compress: true
})

Promise.resolve()
  .then(() => test_core(core))
  .then(() => test_ttl(core))
  .then(() => test_core(compressed))
  .then(() => test_ttl(compressed))
