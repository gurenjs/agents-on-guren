# Product request: Japanese for the blog, with a language switcher

**Requested by:** product (Japan launch)
**Priority:** high, blocks the Japanese announcement

## Why

A good share of our new readers are in Japan, and today every label on the
site is English. We want Japanese as a second language: readers pick it once
and the site stays in Japanese for them, and a first visit from a Japanese
browser should already be in Japanese.

## What we want

- **Two languages: English and Japanese.** English stays the default.
- **A language switcher in the site header**, on every page, for guests and
  signed-in users alike. Picking a language takes the reader back to the page
  they were on, and the choice sticks for their later visits in the same
  browser.
- **First visits follow the browser.** When a reader has not picked a
  language, a browser that asks for Japanese (for example `Accept-Language:
  ja`, or `ja-JP,ja;q=0.9,en;q=0.8`) gets Japanese. Once a reader has picked a
  language, their pick wins over the browser's setting.
- **Real text in both languages.** The header navigation and the posts pages
  (the list, the post page, and the new/edit forms) stop hard-coding their
  labels and read them from the app's translation catalogs, so an English
  reader sees English and a Japanese reader sees Japanese. The Japanese
  catalog goes under `lang/ja/`, next to the English one, and has exactly the
  same keys as the English catalog, including the welcome message that is
  already there. No page or component spells out a translated label such as
  「記事」 itself; it comes from the catalog.

## The contract (what we will check)

- **`POST /locale`** with `{ locale }`, where `locale` is `en` or `ja`, open
  to guests and signed-in users. It remembers the choice for later requests
  from the same browser and redirects back to the page named in the request's
  `Referer`, or to `/` when there is none. Any other value (for example `fr`,
  or a missing field) fails exactly the way an invalid post title fails today,
  and leaves the current choice as it was.
- **Pages report the language.** Every page the server renders already
  carries a shared prop named `_i18n` that tells the page its language and
  hands it the translation catalog. After a reader picks Japanese (or, with no
  pick, sends `Accept-Language: ja`), `_i18n.locale` is `ja` and the Japanese
  catalog in `_i18n` holds the keys below. Without a pick and without a
  Japanese browser, it stays `en`.
- **These keys exist with these Japanese values**, and each has English text
  of its own in the English catalog:

  | Key | Japanese | Used for |
  |---|---|---|
  | `nav.home` | ホーム | header link to `/` |
  | `nav.posts` | 記事 | header link to `/posts` |
  | `nav.dashboard` | ダッシュボード | header link to `/dashboard` |
  | `posts.new` | 新規投稿 | header link to write a post |
  | `posts.edit` | 編集 | Edit control on the post page (`posts/Show`) |
  | `posts.delete` | 削除 | Delete control on the post page (`posts/Show`) |
  | `posts.search` | 検索 | search button on the posts list (`posts/Index`) |
  | `auth.login` | ログイン | header sign-in link |
  | `auth.logout` | ログアウト | header log-out button |

  You may add as many other keys as the pages need.
- **Catalogs stay in step.** Every key in the English catalog exists in the
  Japanese one and the other way round, and the project's own check of the
  translation catalogs passes.

## How this will be checked

The acceptance run drives the app in-process like a browser that keeps its
cookies, runs the catalog check, and reads the page sources for the keys above
and for a hard-coded 「記事」. It does not look at how the switcher is styled.
Everything that works today must keep working.
