// ep_sciencemesh main module
// A plugin to integrate with CS3 storages powered by Reva and WOPI
//
// Initial contribution: Mohammad Warid @waridrox
// Maintainer: Giuseppe Lo Presti @glpatcern
//
// Copyright 2018-2023 CERN
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// In applying this license, CERN does not waive the privileges and immunities
// granted to it by virtue of its status as an Intergovernmental Organization
// or submit itself to any jurisdiction.

'use strict';

const fs = require('fs');
const URL = require('url');
const debounce = require('lodash');
const axios = require('axios');
const api = require('ep_etherpad-lite/node/db/API');
const absolutePaths = require('ep_etherpad-lite/node/utils/AbsolutePaths');
const eejs = require('ep_etherpad-lite/node/eejs')
const padMessageHandler = require('ep_etherpad-lite/node/handler/PadMessageHandler');
const argv = require('ep_etherpad-lite/node/utils/Cli').argv;
import { dbInterface } from './db_interface.js'


// This is taken from ep_etherpad-lite/node/handler/APIHandler.js
let apikey = null;
const apikeyFn = absolutePaths.makeAbsolute(argv.apikey || './APIKEY.txt');
try {
   apikey = fs.readFileSync(apikeyFn, 'utf8');
} catch (e) {
  console.log(`Unable to read the API key from ${apikeyFn}: ${e}`);
}


exports.eejsBlock_modals = (hookName, args, cb) => {
  args.content += eejs.require('ep_sciencemesh/templates/notify.ejs');
  cb();
};

const notifyUser = (padID, message) => {
  let padId = padID
  const msg = {
    type: 'COLLABROOM',
    data: {
      type: 'CUSTOM',
      payload: {
        action: 'recieveNotificationMessage',
        padId,
        message: message,
      },
    },
  };
  padMessageHandler.handleCustomObjectMessage(msg, false)
}


const getMetadata = async (context) => {
  const metaData = dbInterface.getMetadata(${context.pad.id}, ${context.author});

  if (metaData) {
    const queryParams = metaData.split(':');
    const wopiSrc = decodeURIComponent(queryParams[0]);
    const wopiHost = new URL(wopiSrc).origin;
    const accessToken = queryParams[1];

    console.log(`URL for serving requests to the WOPI server: ${wopiSrc}`);

    return [wopiHost, wopiSrc, accessToken];
  }
  else {
    console.log(`metaData values for WOPI server fetched as null from db`);
    return null;
  }
};


const wopiCall = async (wopiHost, wopiSrc, accessToken, padID, close=false) => {
  axios.post(`${wopiHost}/wopi/bridge/${padID}`, null, {
    params: {
      'WOPISrc': ${wopiSrc},
      'access_token': ${accessToken},
      'close': ${close}
    },
    headers: {
      'X-EFSS-Bridged-App': 'Etherpad'
    }
  })
  .then((response) => {
    if (response.status === 202) {
      console.log('wopiCall: enqueued action');
    }
    else {
      console.log('wopiCall: saved');
      notifyUser(padID, response.data);
    }
  })
  .catch((error) => {
    console.log(`wopiCall: error from wopiserver ${error.statusText}: ${error.data.message}`);
    notifyUser(padID, error.data);

    if (error.status === 400 || error.status === 500) {
      // TODO block further edit
    }
  });
};


const postToWopi = async (context) => {
  const metadata = await getMetadata(context);

  if (metadata != null) {
    const [wopiHost, wopiSrc, accessToken] = metadata;
    await wopiCall(wopiHost, wopiSrc, accessToken, context.pad.id);
  }
};


exports.setEFSSMetadata = async (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query;
    console.log('Query from wopiserver:', JSON.stringify(query));

    if (query.apikey !== apikey) {
      console.error('Supplied API key is invalid, apikey should be', apikey);
      res.status(400).send(JSON.stringify({code:1, message:"Invalid API key"}));
      return;
    }

    if (!query.wopiSrc || !query.accessToken) {
      res.status(400).send(JSON.stringify({code:1, message:"Missing arguments"}));
      return;
    }

    const revisionCount = await api.getRevisionsCount(query.padID).catch((err) => {
      if (err.name === 'apierror') return null;
    });
    if (revisionCount) {
      try {
        dbInterface.addMetadataToPad(`${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`);
        res.status(200).send(JSON.stringify({code:0, message:"OK"}));
      }
      catch (err) {
        console.error('Error setting metadata:', JSON.stringify(err));
        res.status(500).send(JSON.stringify({code:3, message:"Error setting metadata: " + err}));
      }
    }
    else {
      console.error('PadID is invalid');
      res.status(400).send(JSON.stringify({code:2, message:"Invalid PadID"}));
    }
  });
};

exports.padUpdate = debounce((hookName, context) => {
  console.log(`Pad content was updated after 3000 ms`);
  postToWopi(context);
}, 3000);

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {
  dbInterface.setAuthorForPad(padId, authorId);
};

exports.userLeave = function(hookName, session, callback) {
  const param = {
    author: session.author,
    pad: {
      id: session.padId
    }
  };

  callback(new Promise(
    async (resolve, reject) => {
      const metadata = await getMetadata(param).catch((err) => { console.error(err) });
      if (metadata !== null) {
        const [wopiHost, wopiSrc, accessToken] = metadata;
        await wopiCall(wopiHost, wopiSrc, accessToken, session.padId, true);
        dbInterface.removeAuthor(session.padId, session.author);

        resolve(console.log(`Exited author content removed successfully from db`));
      }
      else {
        reject(console.error(`Author data doesn\'t exist`));
      }
    }
  ))
  return;
};
