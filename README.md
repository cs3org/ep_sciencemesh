ep_sciencemesh
==============

A plugin to integrate the Etherpad-lite ecosystem to CS3 storages powered by Reva and WOPI

[![NPM version][npm-image]][npm-url]
[![node version][node-image]][node-url]
[![license][license-image]][license-url]
[![npm download][download-image]][download-url]

[npm-image]: http://img.shields.io/npm/v/ep_sciencemesh.svg?style=flat-square
[npm-url]: http://www.npmjs.com/package/ep_sciencemesh
[node-image]: https://img.shields.io/badge/node.js-%3E=_10.17-green.svg?style=flat-square
[node-url]: http://nodejs.org/download/
[license-image]: https://img.shields.io/npm/l/ep_sciencemesh.svg?style=flat-square
[license-url]: https://www.npmjs.com/package/ep_sciencemesh
[download-image]: https://img.shields.io/npm/dt/ep_sciencemesh.svg?style=flat-square
[download-url]: https://www.npmjs.com/package/ep_sciencemesh


## Install

In an already existing etherpad project base directory, run

    npm install ep_sciencemesh

Restart your etherpad-lite instance to recognize the plugin.

To install etherpad, refer [here](https://github.com/ether/etherpad-lite#installation).


## Publish a new version

NPM publishing is automated. To release a new version, tag the local development repository with

    npm version patch

This will bump up one minor version. The general rules for semantic versioning are as follows:

    npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git]

After this, head over to github releases section and tag the version with the new version obtained by executing the above.
