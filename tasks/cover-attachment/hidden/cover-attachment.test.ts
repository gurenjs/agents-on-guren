import { beforeEach, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'
import {
  copiesIn,
  countRows,
  fetchCover,
  form,
  gifBytes,
  indexCoverUrl,
  jpegBytes,
  pngBytes,
  postIdByTitle,
  showCoverUrl,
  upload,
} from './_cover.js'

// The ticket pins: multipart field `cover` on create (POST /posts) and edit
// (PUT /posts/:id), `removeCover` = 1 on edit, `coverUrl: string | null` on the
// post objects of posts/Show (`post`) and posts/Index (`data`), GET <coverUrl>
// serving the bytes with their image type, files kept under the project's
// storage/ and never under public/, and the table `attachments`. Stored files
// are found by content (every upload carries unique bytes); rows are counted
// by table name only, so any correct storage layout passes.

const MB = 1024 * 1024

/** The failure an invalid title gets today on a plain request: 422 with the error keyed on the field. */
async function expectCoverRefused(res: { status: number; json: () => Promise<unknown> }): Promise<void> {
  expect(res.status).toBe(422)
  const body = (await res.json()) as { errors?: Record<string, unknown> }
  expect(Object.keys(body.errors ?? {})).toContain('cover')
}

let seq = 0
function fields(extra: Record<string, string | File> = {}): Record<string, string | File> {
  seq += 1
  return { title: `Cover post ${seq}`, excerpt: 'A short excerpt', body: 'The body of the post.', ...extra }
}

describe('post cover images', () => {
  let http: TestApp
  let author: TestApp

  beforeEach(async () => {
    http = await freshApp()
    author = await asUser(http, await makeUser())
  })

  async function createWithCover(bytes: Uint8Array, name: string, type: string): Promise<{ id: number; url: string }> {
    const data = fields({ cover: upload(bytes, name, type) })
    const res = await author.post('/posts', form(data))
    expect([302, 303]).toContain(res.status)
    const id = await postIdByTitle(data.title as string)
    expect(id).not.toBeNull()
    const url = await showCoverUrl(http, id!)
    expect(typeof url).toBe('string')
    return { id: id!, url: url as string }
  }

  it('stores a PNG cover given on create, reports it on the post page and the list, and serves it', async () => {
    const png = pngBytes()
    const { id, url } = await createWithCover(png, 'cover.png', 'image/png')

    expect(typeof (await indexCoverUrl(http, id))).toBe('string')

    const served = await fetchCover(http, url)
    expect(served.status).toBe(200)
    expect(served.type).toStartWith('image/png')
    expect(Buffer.compare(Buffer.from(served.bytes), Buffer.from(png))).toBe(0)

    expect(copiesIn('storage', png).length).toBeGreaterThanOrEqual(1)
    expect(copiesIn('public', png)).toEqual([])
    expect(await countRows('attachments')).toBe(1)
  })

  it('reports coverUrl null for a post without a cover', async () => {
    const owner = await makeUser()
    const post = await makePost(owner.id)
    expect(await showCoverUrl(http, post.id)).toBeNull()
    expect(await indexCoverUrl(http, post.id)).toBeNull()

    const data = fields()
    const res = await author.post('/posts', form(data))
    expect([302, 303]).toContain(res.status)
    const id = await postIdByTitle(data.title as string)
    expect(await showCoverUrl(http, id!)).toBeNull()
    expect(await countRows('attachments')).toBe(0)
  })

  it('refuses a cover over 2 MB like an invalid title, and saves nothing', async () => {
    const big = pngBytes(3 * MB)
    const before = await countRows('posts')
    const data = fields({ cover: upload(big, 'big.png', 'image/png') })
    await expectCoverRefused(await author.post('/posts', form(data)))
    expect(await countRows('posts')).toBe(before)
    expect(await countRows('attachments')).toBe(0)
    expect(copiesIn('storage', big)).toEqual([])
    expect(copiesIn('public', big)).toEqual([])
  })

  it('refuses a GIF cover on create, and saves nothing', async () => {
    const gif = gifBytes()
    const before = await countRows('posts')
    await expectCoverRefused(await author.post('/posts', form(fields({ cover: upload(gif, 'cover.gif', 'image/gif') }))))
    expect(await countRows('posts')).toBe(before)
    expect(await countRows('attachments')).toBe(0)
    expect(copiesIn('storage', gif)).toEqual([])
    expect(copiesIn('public', gif)).toEqual([])
  })

  it('refuses a GIF on edit and keeps the current cover', async () => {
    const png = pngBytes()
    const { id } = await createWithCover(png, 'cover.png', 'image/png')

    const gif = gifBytes()
    await expectCoverRefused(await author.put(`/posts/${id}`, form(fields({ cover: upload(gif, 'cover.gif', 'image/gif') }))))

    const url = await showCoverUrl(http, id)
    expect(typeof url).toBe('string')
    const served = await fetchCover(http, url as string)
    expect(served.status).toBe(200)
    expect(Buffer.compare(Buffer.from(served.bytes), Buffer.from(png))).toBe(0)
    expect(copiesIn('storage', png).length).toBeGreaterThanOrEqual(1)
    expect(copiesIn('storage', gif)).toEqual([])
    expect(await countRows('attachments')).toBe(1)
  })

  it('replaces the cover on edit: the new JPEG serves, the old file is gone', async () => {
    const png = pngBytes()
    const { id, url: oldUrl } = await createWithCover(png, 'cover.png', 'image/png')

    const jpeg = jpegBytes()
    const res = await author.put(`/posts/${id}`, form(fields({ cover: upload(jpeg, 'cover.jpg', 'image/jpeg') })))
    expect([302, 303]).toContain(res.status)

    const newUrl = await showCoverUrl(http, id)
    expect(typeof newUrl).toBe('string')
    expect(newUrl).not.toBe(oldUrl)
    const served = await fetchCover(http, newUrl as string)
    expect(served.status).toBe(200)
    expect(served.type).toStartWith('image/jpeg')
    expect(Buffer.compare(Buffer.from(served.bytes), Buffer.from(jpeg))).toBe(0)

    expect(copiesIn('storage', png)).toEqual([])
    expect(copiesIn('storage', jpeg).length).toBeGreaterThanOrEqual(1)
    expect(copiesIn('public', jpeg)).toEqual([])
    expect((await fetchCover(http, oldUrl)).status).not.toBe(200)
    expect(await countRows('attachments')).toBe(1)
  })

  it('keeps the cover when the post is edited without touching it', async () => {
    const png = pngBytes()
    const { id } = await createWithCover(png, 'cover.png', 'image/png')

    const res = await author.put(`/posts/${id}`, form(fields()))
    expect([302, 303]).toContain(res.status)

    const url = await showCoverUrl(http, id)
    expect(typeof url).toBe('string')
    expect((await fetchCover(http, url as string)).status).toBe(200)
    expect(copiesIn('storage', png).length).toBeGreaterThanOrEqual(1)
  })

  it('removes the cover when removeCover is sent', async () => {
    const png = pngBytes()
    const { id, url } = await createWithCover(png, 'cover.png', 'image/png')

    const res = await author.put(`/posts/${id}`, form(fields({ removeCover: '1' })))
    expect([302, 303]).toContain(res.status)

    expect(await showCoverUrl(http, id)).toBeNull()
    expect(await indexCoverUrl(http, id)).toBeNull()
    expect(copiesIn('storage', png)).toEqual([])
    expect((await fetchCover(http, url)).status).not.toBe(200)
    expect(await countRows('attachments')).toBe(0)
  })

  it('deletes the cover with the post', async () => {
    const png = pngBytes()
    const { id, url } = await createWithCover(png, 'cover.png', 'image/png')

    const res = await author.delete(`/posts/${id}`)
    expect([302, 303]).toContain(res.status)

    expect(await postIdByTitle(`Cover post ${seq}`)).toBeNull()
    expect(copiesIn('storage', png)).toEqual([])
    expect((await fetchCover(http, url)).status).not.toBe(200)
    expect(await countRows('attachments')).toBe(0)
  })
})
