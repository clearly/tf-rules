'use strict';
const cli = require('./cli');
const _ = require('lodash');
const debug = require('debug')('tfrules/bin/test/cli');

describe('CLI', function() {
  beforeAll(function *() {
    yield cli.main({ plan : './test/data/plan.txt', dryRun : true });
    debug( 'Rules loaded %O', cli.rules );
    debug( 'Config %O', cli.config );
  });  
  it("should load rules as an object", function () {
    expect( typeof cli.rules ).toBe('object');
  });
  it("should load rule configurations as an array", function *() {
    expect( _.isArray(cli.config)).toBeTruthy();
  });
  it("should load custom rule configuration aws-ec2-uses-key-pair", function *() {
    const config = _.find( cli.config, { 'aws-ec2-uses-key-pair': 'MyKey' } );
    expect(config).not.toBe(null);
  });
});

