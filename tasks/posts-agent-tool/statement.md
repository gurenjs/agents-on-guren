# Product request: let authors' own AI assistants search and draft posts

**Requested by:** product, after repeated asks from authors
**Priority:** medium

## Why

Authors increasingly write with an AI assistant. They want to ask it "what
have we already published about Bun?" or "draft a post about today's release"
instead of copying text between the assistant and the site. We do not want a
chatbot in the blog: the assistant is theirs, whichever one they use, and it
should reach the blog over MCP, the standard protocol assistants use to call
tools on other services.

## What we want

- **Two tools, built on what the site already does:** searching posts and
  creating a post, with the website's input rules, validation and permission
  rules. We do not want a second copy of either feature to maintain.
- **Assistants are told which tool only reads.** Search is marked read-only;
  creating a post is not, so an assistant knows to ask its user first.
- **Creating a post is for signed-in users only,** with the same permission
  check as the "New post" form. The post always belongs to the user the
  assistant acts for, whatever the assistant sends.
- **A production endpoint at `/mcp`.** Assistants authenticate with a bearer
  credential that belongs to a user account, and every call acts as that user.
  A call without a credential is refused. The development-only agent endpoint
  the dev server exposes for coding tools does not count: it is absent in
  production and serves different tools.
- **No home-grown protocol code.** Serve the tools the way the framework
  supports for application tools over MCP. We will not maintain our own
  JSON-RPC or MCP handling.
- **Portable tool names.** Some assistants silently drop tools whose names
  contain anything but letters, digits, `_` and `-`, so the names below use
  underscores.

## Contract (what we will check)

- **Tools:** exactly two, named `posts_search` and `posts_store`. Helper tools
  that the MCP server adds by itself (names starting with `guren_`) are
  ignored.
- **`posts_search`:** its input is the body the existing search request
  (`QUERY /posts/search`) takes, `{ "keywords": ["..."] }` with the optional
  `limit`. Its result is the same JSON that request answers with for that
  input, as structured content or as JSON text. Marked read-only. Callable
  without being signed in, like the search on the site.
- **`posts_store`:** input `{ "title", "excerpt", "body" }`. Creates the post
  with the calling user as its author; an `authorId` in the input is ignored.
  Input the web form would reject (for example an empty title) comes back as
  an error result with status **422** and creates nothing. Not marked
  read-only. A caller who is not signed in is refused (**401** or **403**, or
  the redirect to `/login` the web form gives a guest) and nothing is created.
- **`POST /mcp`** without a credential answers **401**. The check creates a
  credential itself, in process, for a test user with access to every tool,
  through the framework's standard API-token support and the token store your
  app configures for it. With that bearer, `tools/list` lists the two tools
  with their read-only flags, and `tools/call` behaves as described above,
  acting as the credential's user.
- **Developer tooling agrees:** the framework's command-line listing of the
  app's agent tools shows exactly the same two tools with the same read-only
  flags, and the project's integrity check (`bunx guren check`) reports no
  failing check. Warnings are fine.

The check does not look at page markup or at tool descriptions.

## Out of scope

A page for users to create or revoke their own credentials (for now ops issues
them from a terminal), tools for editing or deleting posts, human approval of
tool calls, audit logging, and rate limits beyond whatever the endpoint does by
default.
