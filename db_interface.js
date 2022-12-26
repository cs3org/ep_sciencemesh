// ep_sciencemesh db_interface.js
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

'use strict';

const db = require('ep_etherpad-lite/node/db/DB');
const mutex = require('async-mutex');

const dbMutex = new mutex.Mutex();


function addMetadataToPad(padId, metadata) {
  const release = await dbMutex.acquire();
  try {
    await db.set(`efssmetadata:${padId}`, metadata);
  }
  finally {
    release();
  }
}


function setAuthorForPad(padId, authorId) {
  const release = await dbMutex.acquire();
  try {
    const dbkey = `efssmetadata:${padId}`;
    const dbval = await db.get(dbkey);

    if (dbval) {
      await db.set(`${dbkey}:${authorId}`, dbval);
      console.log(`Pad author metadata set successfully in db`);
      await db.remove(dbkey);
    }
    else {
      throw new Error("Author data doesn\'t exist");
    }
  }
  finally {
    release();
  }
}


function getMetadata(padId, authorId) {
  const metadata = await db.get(`efssmetadata:${padId}:${authorId}`).catch((err) => {
    console.error(JSON.stringify(err.message))
  });
  return metadata
}


function removeUser(padId, authorId) {
  const release = await dbMutex.acquire();
  try {
    await db.remove(`efssmetadata:${padId}:${authorId}`);
  }
  finally {
    release();
  }
}
