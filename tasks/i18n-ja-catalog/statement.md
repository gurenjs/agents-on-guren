# Product request: Japanese login and registration pages

**Requested by:** a Japanese-speaking user (relayed by product)
**Priority:** normal

## What happens today

My browser is set to Japanese (it sends `Accept-Language: ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7`
with every request), but the sign-in page at `/login` and the sign-up page at
`/register` are English-only: "Sign in", "Email", "Password", "Create an
account", and so on. The rest of the app can stay English for now, but these
two pages are the first thing every new user sees, and we have Japanese users
who bounce right there.

The app already keeps its English UI text in a translation catalog under
`lang/en/` (today it holds a single welcome message), but the two auth pages
do not use it — their copy is written straight into the page components — and
there is no Japanese catalog at all.

## What we want

1. **Japanese for Japanese browsers.** When the request's `Accept-Language`
   header prefers Japanese (`ja`, `ja-JP`, or a typical browser value such as
   `ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7`), `/login` and `/register` render
   with the Japanese strings below. When there is no `Accept-Language`
   header, when it prefers English (`en`, `en-US,en;q=0.9`), when English
   outranks Japanese (`en-US,en;q=0.9,ja;q=0.5`), or when it names only
   languages we do not have (`fr-FR,fr;q=0.9`), the pages render exactly the
   English they render today. English and Japanese are the only two
   languages for now.

2. **Exact strings.** Use these translations verbatim — the QA checklist and
   the screenshots in the design review are built on them.

   Login page (`/login`):

   | Element | English (today) | Japanese |
   |---|---|---|
   | Page title (browser tab) | Sign in | ログイン |
   | Heading | Sign in | ログイン |
   | Subtitle | Use your account credentials to continue. | アカウントの認証情報を入力して続行してください。 |
   | Email field label | Email | メールアドレス |
   | Password field label | Password | パスワード |
   | Remember-me checkbox label | Remember me | ログイン状態を保持する |
   | Submit button | Sign in | ログイン |
   | Footer question | Don't have an account? | アカウントをお持ちでないですか？ |
   | Footer link | Sign up | アカウント登録 |

   Registration page (`/register`):

   | Element | English (today) | Japanese |
   |---|---|---|
   | Page title (browser tab) | Sign up | アカウント登録 |
   | Heading | Create an account | アカウント登録 |
   | Subtitle | Sign up to get started. | アカウントを作成して始めましょう。 |
   | Name field label | Name | 名前 |
   | Email field label | Email | メールアドレス |
   | Password field label | Password | パスワード |
   | Confirm-password field label | Confirm password | パスワード（確認） |
   | Submit button | Create account | 登録 |
   | Footer question | Already have an account? | すでにアカウントをお持ちですか？ |
   | Footer link | Sign in | ログイン |

3. **One catalog per language, same keys in both.** Move the English copy of
   both pages out of the page components and into the English catalog (keep
   the English wording exactly as it is today), and add a Japanese catalog
   under `lang/ja/`, next to `lang/en/`, using the same file layout and the
   same keys. Every key that exists in English must exist in Japanese and
   vice versa — no page may fall back to English for some of its labels
   because a key was only translated on one side. That includes what is
   already in the English catalog today: the welcome message must get a
   Japanese translation (「:nameへようこそ！」), keeping its `:name`
   placeholder — every placeholder in an English string must survive into
   its Japanese counterpart.

## Unchanged

- Everything else on the site keeps its current English text (the site
  header/navigation is out of scope for this request).
- Signing in and registering keep working exactly as before: same form
  fields, same validation messages, same redirects.
- English visitors must not notice any difference on either page.
