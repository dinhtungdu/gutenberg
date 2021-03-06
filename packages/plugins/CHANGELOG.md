<!-- Learn how to maintain this file at https://github.com/WordPress/gutenberg/tree/HEAD/packages#maintaining-changelogs. -->

## Unreleased

## 2.25.0 (2021-03-17)

### New Features

-   Add optional `settings.scope` field in the `registerPlugin` function ([#27438](https://github.com/WordPress/gutenberg/pull/27438)).
-   Add optional `scope` param in the `getPlugins` function([#27438](https://github.com/WordPress/gutenberg/pull/27438)).
-   Add optional `scope` prop in the `PluginArea` component ([#27438](https://github.com/WordPress/gutenberg/pull/27438)).

## 2.0.10 (2019-01-03)

## 2.0.9 (2018-11-15)

## 2.0.8 (2018-11-09)

## 2.0.7 (2018-11-09)

## 2.0.6 (2018-10-29)

## 2.0.5 (2018-10-20)

## 2.0.4 (2018-10-18)

## 2.0.0 (2018-09-05)

### Breaking Change

-   Change how required built-ins are polyfilled with Babel 7 ([#9171](https://github.com/WordPress/gutenberg/pull/9171)). If you're using an environment that has limited or no support for ES2015+ such as lower versions of IE then using [core-js](https://github.com/zloirock/core-js) or [@babel/polyfill](https://babeljs.io/docs/en/next/babel-polyfill) will add support for these methods.
