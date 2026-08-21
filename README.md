# ASilva Intelligent Assistant Refactor

This package replaces the previous external AI-service chatbot widget with a browser-native intelligent assistant.

## Design

The assistant:

- Reads `credentials.json` as its canonical professional knowledge source.
- Reads `assets/data/system-architecture.json` for platform awareness.
- Performs local semantic matching.
- Understands professional profile, credentials, disciplines, projects, publications, and system modules.
- Detects strategic, systems, futures, cognitive, resilience, innovation, and physical-science reasoning cues.
- Produces deterministic analysis and recommendations.
- Does not require a Moonshot, Kimi, OpenAI, or other external AI API key.
- Does not transmit visitor questions to an external AI service.
- Preserves the existing ASilva visual identity and widget interaction model.

## Integration

Replace:

`assets/asilva-widget.js`

with the supplied version.

Add:

`assets/data/system-architecture.json`

The existing page inclusion can remain:

`<script src="assets/asilva-widget.js" defer></script>`

The site should be served through HTTP or HTTPS so that the assistant can load JSON resources with `fetch()`.

## Important distinction

This implementation is an intelligent deterministic chatbot, not a generative large language model.

It is intentionally designed this way because removing external AI services means there is no remote model available to perform unrestricted natural-language generation.

For deeper generative reasoning in a future phase, a server-side model gateway can be added without exposing API credentials to the browser.
