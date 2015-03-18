# Overview

This is a complete rewrite of the original restify-endpoints project. This will support full auto-documentation as well as being able to be attached to restify, express, or a vanilla http service with a router attached.


## 

### Restify

```javascript
var restity = require('restify')
var endpoints = new endpoints.EndpointManager()

endpoints.attach(restify)
restify.listen(8000)
```

### Express

```javascript
var express = require('express')
var endpoints = new endpoints.EndpointManager()

endpoints.attach(express)
express.listen(8000)
```

### Vanilla HTTP

With vanilla node HTTP you'll need a router attached.

```javascript
var http = require('http')
var router = require('router')()
var endpoints = new endpoints.EndpointManager()

function finalHandler(req, res) { }

var server = http.createServer(function(req, res) {
  router(req, res, finalHandler(req, res))
})

endpoints.attach(server)

server.listen(8000)
```
