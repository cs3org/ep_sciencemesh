// ep_sciencemesh - DB interface
// A plugin to integrate with CS3 storages powered by Reva and WOPI
//
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

const db = require('ep_etherpad-lite/node/db/DB')
const mutex = require('async-mutex')

const dbMutex = new mutex.Mutex()

async function addMetadataToPad (padId, metadata) {
  const release = await dbMutex.acquire()
  try {
    const md = await db.get(`efssmetadata:${padId}`)
    if (md == null) {
      // first metadata payload for this pad
      await db.set(`efssmetadata:${padId}`, metadata)
    } else {
      // append another metadata payload
      await db.set(`efssmetadata:${padId}`, md + '_' + metadata)
    }
  } finally {
    release()
  }
}

async function setAuthorForPad (padId, authorId) {
  const release = await dbMutex.acquire()
  try {
    const pendingmd = await db.get(`efssmetadata:${padId}`)
    if (pendingmd == null) {
      // this may currently happen if a pad was created directly with Etherpad
      // TODO need to understand what happens with this uncaught error
      throw new Error('No outstanding metadata available to set a new author')
    }

    if (pendingmd.indexOf('_') > 0) {
      // get first metadata payload for this author and keep the rest
      await db.set(`efssmetadata:${padId}:${authorId}`, pendingmd.substring(0, pendingmd.indexOf('_')))
      await db.set(`efssmetadata:${padId}`, pendingmd.substring(pendingmd.indexOf('_') + 1))
    } else {
      // we found a single payload, use it and drop pending key
      await db.set(`efssmetadata:${padId}:${authorId}`, pendingmd)
      await db.remove(`efssmetadata:${padId}`)
    }
  } finally {
    release()
  }
}

async function getMetadata (padId, authorId) {
  // return required metadata, errors are thrown to the caller
  const metadata = await db.get(`efssmetadata:${padId}:${authorId}`)
  if (metadata == null) {
    throw new Error(`Metadata not found for padId = ${padId} and authorId = ${authorId}`)
  }
  return metadata
}

async function removeAuthor (padId, authorId) {
  // the mutex is not strictly needed here but for consistency we keep it
  const release = await dbMutex.acquire()
  try {
    await db.remove(`efssmetadata:${padId}:${authorId}`)
  } finally {
    release()
  }
}


module.exports.addMetadataToPad = addMetadataToPad
module.exports.setAuthorForPad = setAuthorForPad
module.exports.getMetadata = getMetadata
module.exports.removeAuthor = removeAuthor
