import type { VercelRequest, VercelResponse } from '@vercel/node'

const OWNER = 'camofy'
const REPO = 'camofy'

/**
 * 通用 GitHub 代理：
 *
 * 将 mirror.camofy.app 上的路径：
 *   /camofy/camofy/releases/latest/download/camofy-linux-amd64
 *   /camofy/camofy/raw/main/install.sh
 *
 * 转发到 GitHub：
 *   https://github.com/camofy/camofy/releases/latest/download/camofy-linux-amd64
 *   https://github.com/camofy/camofy/raw/main/install.sh
 *
 * 这样用户只需替换域名（github.com -> mirror.camofy.app），路径保持不变。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParam = req.query.path
  const segments = Array.isArray(pathParam)
    ? pathParam
    : typeof pathParam === 'string'
      ? [pathParam]
      : []

  if (segments.length < 3) {
    res.status(400).json({ error: 'invalid_path', hint: 'expected /owner/repo/...' })
    return
  }

  const [owner, repo, ...rest] = segments

  if (owner !== OWNER || repo !== REPO) {
    res.status(400).json({ error: 'unsupported_repository', owner, repo })
    return
  }

  const relPath = [owner, repo, ...rest].join('/')

  // 保留原始查询参数（如果有）
  const urlFromReq = req.url || ''
  const qsIndex = urlFromReq.indexOf('?')
  const queryString = qsIndex >= 0 ? urlFromReq.slice(qsIndex + 1) : ''

  const upstreamUrl = `https://github.com/${relPath}${queryString ? `?${queryString}` : ''}`

  try {
    const upstreamRes = await fetch(upstreamUrl)

    if (!upstreamRes.body) {
      res.status(upstreamRes.status).json({
        error: 'upstream_no_body',
        status: upstreamRes.status,
        url: upstreamUrl,
      })
      return
    }

    // 透传状态码与部分头信息
    res.statusCode = upstreamRes.status

    const contentType = upstreamRes.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    const cacheControl = upstreamRes.headers.get('cache-control')
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl)
    } else {
      // 对于 release 资源可以适当缓存
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400')
    }

    // 将上游响应体直接流式回传给客户端
    // @ts-ignore Node 运行时下 body 是一个可读流
    upstreamRes.body.pipe(res)
  } catch (err) {
    res.status(502).json({
      error: 'upstream_error',
      message: err instanceof Error ? err.message : String(err),
      url: upstreamUrl,
    })
  }
}

