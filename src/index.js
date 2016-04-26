import path from 'path';
import _ from 'lodash';
import Promise from 'bluebird';
require('dotenv').config({path: path.resolve(__dirname, '../.env')});

import bodyParser from 'body-parser';

var express = require('express');
var app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));

import request from 'request-promise';

const form = `
  <form action="/" method="post">
    input :
    <textarea name="inputString"></textarea>
    <button>submit</button>
  </form>
`;

function fetchVideoDataWithToken(videoId, token) {
  return request.get({
    uri: 'https://api.vimeo.com/videos/' + videoId,
    headers: {
      'Authorization': `bearer ${token}`
    }
  }).then(function (content) {
    return JSON.parse(content);
  });
}

const fetchVideoData = _.partialRight(fetchVideoDataWithToken, process.env.VIMEO_TOKEN);

function serializeVideoData(data) {
  return data.files.map(fileData => {
    return `${fileData.quality} ${fileData.width}x${fileData.height}:\n${fileData.link}`;
  }).join('\n');
}

var vimeoUrlRegexp = /https:\/\/vimeo.com\/(\d+)/g;

function transformStringsContainingVimeoUrls (inputString) {
  let match, videoIDs = [];

  while ((match = vimeoUrlRegexp.exec(inputString)) !== null) {
    videoIDs.push(match[1]);
  }

  return Promise.all(videoIDs.map((id) => fetchVideoData(id)))
    .map((data) => {
      const dataString = serializeVideoData(data) + '\n\n';
      const url = data.link;
      return {dataString, vimeoUrl: url};
    })
    .then(videoCollectionData => {
      return inputString.replace(vimeoUrlRegexp, function (matchedVideoURL) {
        return _.find(videoCollectionData, {vimeoUrl: matchedVideoURL}).dataString;
      });
    });
}

app.get('/', function (req, res) {
  res.send(form);
});

app.post('/', function (req, res) {
  transformStringsContainingVimeoUrls(req.body && req.body.inputString).then(function (contents) {
    res.send(form + `<pre class="results">${contents}</pre>`);
  });
});

app.listen(3000, function () {
  console.log('app listening on port 3000!');
});
