# books-db

This is currently a learning app for Candid Engineering (@rkofman && @SilverMaiden) to practice svelte + desktop development. The goal is to have a simple application for tracking one's physical book library.

Current tech stack:

- Svelte + SvelteKit + Typescript
- Vitest (.js unit testing)
- Bulma (CSS framework)
- Tauri (WebView frontend + Rust backend)

And some are open questions:

- Local storage:
  - [sqlite](https://www.sqlite.org/)? ([guide](https://blog.moonguard.dev/how-to-use-local-sqlite-database-with-tauri))
  - [Tauri store](https://v2.tauri.app/plugin/store/)?
  - [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/Window/indexedDB) (likely with a wrapping library for ease of use)
  - [tauri-plugin-store](https://github.com/tauri-apps/tauri-plugin-store)
- Data syncing to a backend
- The backend itself

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Rust](https://marketplace.visualstudio.com/items?itemName=1YiB.rust-bundle)

## Project Setup

### Pre-requisites

Before getting started, make sure the following is set up on your machine:

- Rust [pre-requisites for Tauri](https://tauri.app/v1/guides/getting-started/prerequisites/)

### Install

It is recommended to use a node version manager such as <a href="https://github.com/nodenv/nodenv">nodenv</a> to install the required version of node. See `.node-version` for the current required version.

We also specify a specific version of `pnpm` in the `packageManager` field of `package.json`. Make sure to have it installed.

To install javascript packages, we use the pnpm package manager:

```bash
pnpm install
```

## Testing

### Unit tests

The default test command is:

```bash
pnpm test
```

This will run the javascript unit tests (files ending in `.spec` within `/src-ui`) as well as the rust tests (test modules within `/src-tauri`).

#### Watching for changes

A common way to have a quick development cycle is to keep a window open running tests in **watch** mode. This will re-run the tests any time relevant files change.

For javascript, that's available via:

```bash
pnpm js:test
```

Our rust code is not yet set-up for watch; but should be easy to add as an exercise left to the reader.

### Integration tests

Integration tests are only available on Windows at this time. Before running them, you must download the version of [MS Edge Driver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/?form=MA13LH) that corresponds to your MS Edge browser.

(keeping the driver up to date over time is an exercise left to the reader)

Once that's installed, make sure to [_add it to your PATH_](https://www.architectryan.com/2018/03/17/add-to-the-path-on-windows-10/)\_.

Then install `tauri-driver`:

```bash
cargo install tauri-driver
```

Once that's done, you should be able to run end to end tests:

```bash
pnpm e2e:test
```

## Developing

As an easy way to get started, run a SvelteKit development server (no Electron/Tauri features):

```bash
pnpm run svelte:dev
```

To run the full app including Tauri and native Rust code:

```bash
pnpm run dev
```

## Building

(This section may need to be filled out if there are any gotchas or required secrets to include when building)

```bash
pnpm run build
```
