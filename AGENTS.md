# Agent Guidelines

- install: `npm install`
- run: `npm start` (Eleventy dev server)
- test: `npm test`, `npm run coverage`
- format: `npm run format`

Node 22.12+. Do not alter version. Push to `main` deploys https://ungoldman.com via `deploy.yml`.

## Conventions

- Atomic conventional commits, `<topic>: <action>`, 50 chars max. Body only when needed. Wrap at 72.
- No AI attribution in commits.
- Breaking changes discouraged. They need `BREAKING CHANGE:` footer.
- Plain JS modules. No build beyond Eleventy.
- Few comments, kept trim.
- 100% coverage on `router/`. `router.js` is checked in browser.

## Page contract

`router.js` swaps same-origin pages in place, so pages deployed from other repos under this origin can join it. A page joins by keeping this contract:

- Loads `<script type="module" src="/router.js"></script>`. Links to pages without it get a full load.
- Boots its app from an inline module script that tears down on `router:leave`:

  ```html
  <script type="module">
    import { mount } from './app.js'
    addEventListener('router:leave', mount(), { once: true })
  </script>
  ```

- `mount()` can run again in the same document, and the function it returns removes every listener and stops every loop.
- Owns its scene and controls. It may animate them in on mount, and out from its teardown, which gets the leave event. `event.waitUntil(promise)` keeps the outgoing page in place until the promise settles, for up to a second.
- Looks up its elements by id at mount time. Incoming nodes precede outgoing ones, so ids resolve to the new page when both have them. Outgoing nodes are `inert`, so a lookup for an element the new page lacks should skip those.

The router animates only the shared chrome. Fold plays between the index readout (`.telemetry`) and an experiment `header` holding `#home`, `h1`, and `.rule`. Other pairs swap without a transition.
