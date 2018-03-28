'use strict';
const rule = require('./aws-ec2-instance-tag-format');
const _ = require('lodash');
const co = require('co');
const debug = require('debug')('snitch/aws-ec2-uses-key-pair');

describe('aws-ec2-instance-tag-format', function() {
    it("should return a valid = 'success'", co.wrap(function *() {
        const instance = {
            key_name : 'real-key-name',
            tags: {
                ApplicationCode : 'TST',
                Name : 'TestInstance'
            }
        };

        const provider = { };
        const context = {
            config : [{type: "Name", format:/(.*?)/}],
            instance,
            provider
        };
        const result = yield rule.validate( context );
        expect(result.valid).toBe('success');
    }));
    it("should return a valid = 'fail'", co.wrap(function *() {
        const instance = {
            tags: {
                ApplicationCode : 'TST',
                Name : 'TestInstance'
            }
        };

        const provider = { };
        const context = {
            config : [{type: "Name", format:/^RealInstance/}],
            instance,
            provider
        };
        const result = yield rule.validate( context );
        expect(result.valid).toBe('fail');
    }));
});