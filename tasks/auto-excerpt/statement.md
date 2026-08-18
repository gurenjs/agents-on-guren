# Product request: make the excerpt optional and derive it from the body

**Requested by:** product / editorial
**Priority:** normal

## Background

Every post has an **Excerpt** — the short teaser shown on the post cards at
`/posts` and searched by the search box. Today the "Excerpt" field on the
**New post** form (`/posts/create`) and the **Edit post** form
(`/posts/<id>/edit`) is mandatory: leaving it blank is rejected as
"Excerpt is required." and the post is not saved. Writers tell us they
usually just paste the opening of the body into it anyway. Let the site do
that for them.

## What we want

1. **The Excerpt field becomes optional** on both forms. Submitting the
   create form (`POST /posts`) or the edit form (`PUT /posts/<id>`) with the
   excerpt missing, empty, or containing only whitespace must succeed and
   redirect exactly as a submission with an excerpt does today.
2. **When no excerpt is given, derive one from the body** — on create *and*
   on update (an update that leaves the excerpt empty re-derives it from the
   *new* body, replacing whatever excerpt the post had). The stored excerpt
   is never empty.
3. **When an excerpt is given, store it as typed** (leading/trailing
   whitespace trimmed, as today). A provided excerpt always wins over the
   derived one.
4. Everything else about validation is unchanged: a blank title or a blank
   body is still refused with the usual validation error (`422`), and
   nothing is saved.

## The derivation rule

Apply this to the body after trimming leading and trailing whitespace:

- If the body is **140 characters or fewer**, the excerpt is the whole body,
  unchanged, with no ellipsis.
- Otherwise take the **first 140 characters**, but **never cut a word in
  half**: if character 141 falls inside a word (that is, character 140 and
  character 141 are both non-whitespace), cut instead at the **last
  whitespace before it**. If character 141 is whitespace, all 140 characters
  are kept. If the first 140 characters contain no whitespace at all (one
  unbroken run), cut at 140.
- Trim trailing whitespace from the kept part, then append a single
  ellipsis character `…` (U+2026, one character — not three periods).

"Character" means what `String.length` counts; "whitespace" means what
`\s` matches (spaces, tabs, newlines).

### Worked example 1 — the cut lands inside a word

Body (exactly 150 characters):

```
The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown
```

The first 140 characters end with `The q`; character 141 is `u`, inside the
word `quick`. Cut at the last whitespace before it (the space after `The`),
trim, append the ellipsis. Stored excerpt (139 characters):

```
The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The…
```

### Worked example 2 — the cut lands exactly on a word boundary

Body (170 characters):

```
When a post is saved without an excerpt, the site now writes one for the author by keeping the opening of the body intact and stopping right at a space, then adds a mark.
```

The first 140 characters end with the word `right`, and character 141 is a
space, so nothing is cut back. Stored excerpt (141 characters):

```
When a post is saved without an excerpt, the site now writes one for the author by keeping the opening of the body intact and stopping right…
```

## Forms

Both forms should present the field as optional (drop any "required"
marking, and a hint like "(optional)" or a placeholder explaining the
fallback is welcome). The forms must still submit fine when the field is
left blank.

## Unchanged

- Creating and editing stay signed-in only, and editing stays limited to
  the post's author, exactly as today.
- Post cards, the post page, and search keep showing and using the stored
  excerpt; nothing else on the site should change.
