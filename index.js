// ep_sciencemesh - main module
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

'use strict'

const fs = require('fs')
const URL = require('url')
const debounce = require('lodash')
const axios = require('axios')
const log4js = require('ep_etherpad-lite/node_modules/log4js')
const api = require('ep_etherpad-lite/node/db/API')
const absolutePaths = require('ep_etherpad-lite/node/utils/AbsolutePaths')
const eejs = require('ep_etherpad-lite/node/eejs')
const padMessageHandler = require('ep_etherpad-lite/node/handler/PadMessageHandler')
const argv = require('ep_etherpad-lite/node/utils/Cli').argv

const smLogger = log4js.getLogger('ScienceMesh')
const dbInterface = require('./db_interface.js')

// This is taken from ep_etherpad-lite/node/handler/APIHandler.js
let apikey = null
const apikeyFn = absolutePaths.makeAbsolute(argv.apikey || './APIKEY.txt')
try {
  apikey = fs.readFileSync(apikeyFn, 'utf8').trim()
} catch (err) {
  smLogger.error(`Unable to read the API key from ${apikeyFn}:`, JSON.stringify(err))
}

exports.eejsBlock_modals = (hookName, args, cb) => {
  args.content += eejs.require('ep_sciencemesh/templates/notify.ejs')
  cb()
}

const notifyUser = (padID, message) => {
  const padId = padID
  const msg = {
    type: 'COLLABROOM',
    data: {
      type: 'CUSTOM',
      payload: {
        action: 'userNotification',
        padId,
        message
      }
    }
  }
  padMessageHandler.handleCustomObjectMessage(msg, false)
}

const getMetadata = async (context) => {
  const metadata = dbInterface.getMetadata(`${context.pad.id}`, `${context.author}`)

  // returns a (wopiHost, wopiSrc, accessToken) tuple
  const params = metadata.split(':')
  const wopiSrc = decodeURIComponent(params[0])
  smLogger.debug(`WOPI server URL: ${wopiSrc}`)
  return [new URL(wopiSrc).origin, wopiSrc, params[1]]
}

const wopiCall = async (wopiHost, wopiSrc, accessToken, padID, close = false) => {
  axios.post(`${wopiHost}/wopi/bridge/${padID}`, null, {
    params: {
      WOPISrc: `${wopiSrc}`,
      access_token: `${accessToken}`,
      close: `${close}`
    },
    headers: {
      'X-EFSS-Bridged-App': 'Etherpad'
    }
  })
    .then((response) => {
      if (response.status === 202) {
        smLogger.debug('wopiCall: enqueued action')
      } else {
        smLogger.debug('wopiCall: saved')
        notifyUser(padID, response.data)
      }
    })
    .catch((error) => {
      smLogger.warn(`wopiCall: error ${error.statusText}: ${error.data.message}`)
      notifyUser(padID, error.data)

      if (error.status === 400 || error.status === 500) {
      // TODO block further edit
      }
    })
}

// ### Exposed API ###

exports.setEFSSMetadata = async (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query

    if (query.apikey !== apikey) {
      smLogger.warn('setEFSSMetadata: invalid API key')
      res.status(401).send(JSON.stringify({ code: 1, message: 'Invalid API key' }))
      return
    }

    if (!query.wopiSrc || !query.accessToken || !query.padID) {
      smLogger.warn('setEFSSMetadata: missing arguments in query parameters', JSON.stringify(query))
      res.status(400).send(JSON.stringify({ code: 1, message: 'Missing arguments' }))
      return
    }

    const revisionCount = await api.getRevisionsCount(query.padID).catch((err) => {
      if (err.name === 'apierror') return null
    })
    if (revisionCount) {
      try {
        dbInterface.addMetadataToPad(`${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`)
        smLogger.info(`setEFSSMetadata: successfully added token ${query.accessToken} to ${query.padID}`)
        res.status(200).send(JSON.stringify({ code: 0, message: 'OK' }))
      } catch (err) {
        smLogger.error(`setEFSSMetadata: error setting metadata: ${err}`)
        res.status(500).send(JSON.stringify({ code: 3, message: `Error setting metadata: ${err}` }))
      }
    } else {
      smLogger.warn(`setEFSSMetadata: invalid pad ID '${query.padID}'`)
      res.status(404).send(JSON.stringify({ code: 2, message: 'PadID invalid or not found' }))
    }
  })
}

exports.padUpdate = debounce((hookName, context) => {
  smLogger.debug('Pad content was updated after 3000 ms')

  const metadata = getMetadata(context).catch((err) => {
    smLogger.error(`padUpdate: error getting metadata for pad ${context.pad.id}:`, JSON.stringify(err))
    notifyUser(context.pad.id, 'Error getting metadata for pad: ' + err)
  })

  const [wopiHost, wopiSrc, accessToken] = metadata
  wopiCall(wopiHost, wopiSrc, accessToken, context.pad.id)
}, 3000)

exports.userJoin = async (hookName, { authorId, displayName, padId }) => {
  smLogger.info(`Author ${authorId} joined pad ${padId}, setting metadata`)
  dbInterface.setAuthorForPad(padId, authorId)
}

exports.userLeave = function (hookName, session, callback) {
  const param = {
    author: session.author,
    pad: {
      id: session.padId
    }
  }

  callback(new Promise(
    async (resolve, reject) => {
      const metadata = await getMetadata(param).catch((err) => {
        reject(smLogger.error(`userLeave: error getting metadata for pad ${param.pad.id}:`, JSON.stringify(err)))
      })

      const [wopiHost, wopiSrc, accessToken] = metadata
      await wopiCall(wopiHost, wopiSrc, accessToken, session.padId, true)
      await dbInterface.removeAuthor(session.padId, session.author)
      resolve(smLogger.info(`userLeave: author ${session.author} left pad ${session.padId}`))
    }
  ))
}
