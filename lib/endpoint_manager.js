var path = require('path');
var fs = require('fs');
var restify = require('restify');

var available_middleware = require('./middleware');

var EndpointManager = module.exports.EndpointManager = function(options) {
  if (typeof(options) !== "undefined") {
    this.options = options;
  } else {
    this.options = {};
    options = {};
  }

  this.endpoints = [];
  this.middleware = [];

  this.endpoint_modules = {};

  this.options.auth = options.auth || { method: 'httpSignature', provider: 'sqlite3', dbstring: 'sqlite3://data//keys.db' };

  if (this.options.auth !== false && typeof(this.options.auth) !== 'object') {
    throw new Error('auth either must be false or an object containing method, provider, dbstring');
  }

  if (typeof(this.options.endpoint_args) == "undefined") {
    this.options.endpoint_args = [];
  }

  // Find all defined endpoints from the endpoint path
  if (options.endpointpath) {
    this.autodiscover(options.endpointpath, this.options.endpoint_args);
  }
};

// Perform basic validation and add endpoint to endpoints array,
// will be attached to the Restify Server later on.
EndpointManager.prototype.addEndpoint = function(endpoint) {
  if (!endpoint.name) {
    throw new Error('Name is required as an endpoint definition');
  }
  
  if (!endpoint.method) {
    throw new Error('Method is required for endpoint definition');
  }
  
  if (!endpoint.fn) {
    throw new Error('fn is required to define an endpoint');
  }

  // TODO: add other validation checks.

  // Add the endpoint to the endpoints
  this.endpoints.push(endpoint);
};

EndpointManager.prototype.addMiddleware = function(middleware) {
  var self = this;

  
};
 
EndpointManager.prototype.autodiscover = function(endpointpath, endpoint_args) {
  var self = this;

  // find all endpoints in `path`, similar to your `middleware/index.js` file
  var files = fs.readdirSync(endpointpath);

  // loop through endpoint files and load them.
  for (var i = 0; i < files.length; i++ ) {
  	var extname  = path.extname(files[i]);
  	var basename = path.basename(files[i], '.js');

  	if (extname == '.js' && self.endpoint_modules[files[i]] !== true) {
  		self.endpoint_modules[basename] = require(endpointpath + '/' + files[i]).apply(null, endpoint_args);
  	}
  }

  // iterate through endpoint files
  Object.keys(self.endpoint_modules).forEach(function (c) {
  	var endpoints = self.endpoint_modules[c].endpoints;

    if (typeof(endpoints) !== "undefined") {
      // Add new endpoints to the list (keeping the list flat).
      endpoints.forEach(function(endpoint) {
        self.addEndpoint(endpoint);
      }.bind(self));
    }
  });
};

// Attach to the Restify Server
EndpointManager.prototype.attach = function (server) {
  this.createRoutes(server);
};

// Loop through all defined endpoints, add them to the Restify Server
EndpointManager.prototype.createRoutes = function(server) {
  var self = this;

  // Here we add each endpoint as a route to the server.
  var allowed_methods = { 'GET' : true, 'POST' : true, 'PUT' : true, 'DEL' : true };

  this.endpoints.forEach(function(endpoint) {
    // Check if the handler is a function.
    if (typeof endpoint.fn !== 'function') {
      // throw an error/show a warning...
      return;
    }
 
    // Create a middleware chain.
    var middleware = [];
 
    // If we require input validation for this endpoint,
    // add a validator middleware to the chain.
    if (endpoint.params) {
      middleware.push(self.validator(endpoint));
    }
    
    // TODO: implement authentication middleware
    if (endpoint.auth != false) {
      if (self.options.auth.method === 'httpSignature') {
        middleware.push(available_middleware.httpSignature(endpoint, self.options.auth));
      }
      else {
        throw new Error(self.options.auth.method + ' not supported for authentication');
      }
    }

    // Allow each endpoint to define additional middleware
    if (typeof(endpoint.middleware) != "undefined") {
      for (var x=0; x<endpoint.middleware.length; x++) {
        middleware.push(endpoint.middleware[x]);
      }
    }
 
    // Add the handler function to the middleware chain (bind it to
    // the endpoint object so it can access its own properties from
    // inside the handler function, if so required).
    middleware.push(endpoint.fn.bind(endpoint));
 
    // Create a list of methods for this endpoint.
    var methods = endpoint.method;
    if (methods.constructor.name !== 'Array') {
      methods = [ methods ];
    }
 
    // Add a route handler for each method.
    methods.forEach(function(method) {
      // Check if the method is allowed.
      if (allowed_methods[method] !== true) {
        // throw an error/show a warning...
        return;
      }
 
      // Create a handler.
      server[method.toLowerCase()]({
        path : endpoint.path,
        version : endpoint.version
      }, middleware);
    });
  });
};

// Validate parameters, based on the endpoint.params definition
EndpointManager.prototype.validator = function(endpoint) {
  return function(req, res, next) {
    // Check params against incoming data.
    Object.keys(endpoint.params).forEach(function(index) {
      var param = endpoint.params[index];
      var value = req.params[param.name];

      // TODO -- use validator npm module to validate parameters ...
      // Check `required` state.
      if (param.required === true && value === undefined) {
        return next(new restify.InvalidArgumentError(param.name, 'Required parameter not present'));
      }
      else if (param.type === 'numeric' && typeof(param.value) !== 'numeric') {
        return next(new restify.InvalidArgumentError(param.name, 'Invalid value given for parameter'));
      }
    });
 
    // Done.
    return next();
  };
};