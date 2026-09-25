You are working in an existing web application in the current directory. Read
the task below and make the change in this codebase, following the project's
existing conventions, file layout, and code style.

## Definition of done

- `bun run typecheck` passes.
- `bun test` (the project's existing test suite, plus any tests you add) passes.

That is the whole definition — you do NOT need to boot the app or verify the
change over HTTP; functional acceptance is checked externally afterwards by a
hidden test suite that exercises the behaviour described in the task.

## Runner notes

This session runs under a command allowlist. Write and edit files with the
Write and Edit tools, not with shell heredocs (`cat > file <<EOF` is denied).
Do not chain commands after `cd`; run tools from the project root with
relative paths. To set an environment variable for one command, write
`env NAME=value command ...` (a bare `NAME=value command` prefix is denied).

Work autonomously: do not ask questions, do not stop to request confirmation.
When you are done, end your final message with a one-paragraph summary of what
you changed and where.

## Task
