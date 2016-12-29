'use strict';
const _  = require('lodash');
const debug = require('debug')('tfrules/tag-format');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const EC2TagFormat = {};

EC2TagFormat.docs = {
  description: "Tag values must match provided format",
  recommended: false
};

EC2TagFormat.schema = {
  type : 'array',
  items : {
    type : 'string'
  }
};

EC2TagFormat.schema = {
  type : 'array',
  items : {
    type : 'object',
    properties : {
      name : {
        type : 'string'
      },
      format : {
        type : 'string'
      }
    }        
  }
};

EC2TagFormat.paths = {
  awsInstance : 'aws_instance'
};

EC2TagFormat.validate = function( context ) {
  let result = null;
  let tagSpec = null;
  let reqTags = [];
  let matchErrors = [];
  let message = ''

  debug('Config: %j', context.config)
  for ( let tagSpec of context.config){
    if (tagSpec.format) {
      let re = new RegExp(tagSpec.format);
      debug('Match: %j', context.instance.tags[tagSpec.name].match(re))
      if ( ! context.instance.tags[tagSpec.name].match(re)) {
        matchErrors.push(tagSpec.name)
      }
    }
    debug('Tag: %j', tagSpec)
  }

  if (matchErrors.length == 0) {
    result = {
      'valid' : 'success'
    }
  } else {
    result = {
      valid : 'fail',
      message : 'Tag Value does not match format provided in rules file for the following tags: ' + matchErrors.join()
    }
  }

  return result;
};

module.exports = EC2TagFormat;
