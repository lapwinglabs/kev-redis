var Kev = require('kev')
var KevRedis = require('../index.js')
var assert = require('assert')

var kevredis = Kev({ store: KevRedis( { port: process.env.REDIS_PORT } ) })

var kevs = [kevredis]

kevs.forEach(function(kev) {
  kev.put('key1', 'value1', function(err) {
    kev.get('key1', function(err, value) {
      assert.equal(value, 'value1')
      kev.del('key1', function(err, old) {
        assert.equal(old, 'value1')
        kev.get('key1', function(err, value) {
          assert.equal(value, null)
          kev.close()
          console.log('Pass!')
        })
      })
    })
  })
})