# books-db

This is currently a learning app for @rkofman to practice svelte + electron.js. The goal is to have a simple application for tracking one's physical book library. It is (going to be) implemented as an Electron application with Svelte and TypeScript.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)

## Project Setup

### Install

It is recommended to use a node version manager such as <a href="https://github.com/nodenv/nodenv">nodenv</a> to install the required version of node. See `.node-version` for the current required version.

We also specify a specific version of `pnpm` in the `packageManager` field of `package.json`. Make sure to have it installed.

To install javascript packages, we use the previously installed pnpm package manager:
```bash
pnpm install
```

## Testing
To run javascript unit tests, we use vitest; launched via pnpm:

```bash
pnpm test
```
## Developing

Start a SvelteKit development server (no Electron/Tauri features available):

```bash
pnpm run svelte:dev
```

Start the existing Electron app:

```bash
pnpm run electron:dev
```


## Building
