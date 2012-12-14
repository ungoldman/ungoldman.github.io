---
layout: portfolio_page
title: Earth Tweets
description: A mashup of Google's WebGL Globe and Twitter's Streaming API running on a Node.js server.
site: http://earth-tweets.herokuapp.com
source: https://github.com/ngoldman/earth-tweets
image: /img/work/earth-tweets.jpg
category: lab
tags: node.js, javascript, webgl, websocket, streaming, html5
---

Earth Tweets is a quick tech demo I put together after getting inspired by the Google Data Arts Team's [WebGL Globe](http://www.chromeexperiments.com/globe) Chrome Experiment. I thought it would be interesting to pull live data from the Twitter Streaming API and map it onto a three dimensional representation of the Earth. The front end JavaScript is heavily reliant on new technology that's not incorporated in all modern browsers, so it's only likely to work on the latest WebKit browsers (Chrome and Safari) and maybe Firefox too. I borrowed a lot of code from the now defunct [World Weather](http://www.clicktorelease.com/code/weather/) experiment, which was also derivative of WebGL Globe. The back end is a Node.js server pulling data from the Twitter Streaming API using the [twit](https://github.com/ttezel/twit) node module, then feeding it to the front end via WebSocket using [socket.io](http://socket.io/).
