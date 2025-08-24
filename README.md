# Assistant Chat Backend

A minimal Express.js backend that connects to the OpenAI Assistants API.

## Endpoints

- `POST /chat` → send/receive messages
- `POST /reset` → clear thread

## Environment Variables

Set these in Render or locally in a `.env` file:

- `OPENAI_API_KEY` = your OpenAI API key
- `ASSISTANT_ID` = your Assistant ID
