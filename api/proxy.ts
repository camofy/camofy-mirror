import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let { path } = req.query;

  // Handle case where path might be an array or undefined
  const pathStr = Array.isArray(path) ? path.join('/') : (path || '');

  // Log for debugging (as requested by user to verify it works)
  console.log('Proxy hit, path =', pathStr);

  if (!pathStr) {
    res.status(400).send('Path is required');
    return;
  }

  // Validation: limit owner to camofy or MetaCubeX
  const parts = pathStr.split('/');
  const allowedOwners = ['camofy', 'MetaCubeX'];

  let owner: string | undefined;
  let baseUrl = 'https://github.com';

  if (parts[0] === 'repos') {
      // API request: https://api.github.com/repos/OWNER/REPO/...
      owner = parts[1];
      baseUrl = 'https://api.github.com';
  } else {
      // Standard GitHub web URL
      owner = parts[0];
  }

  if (!owner || !allowedOwners.some(o => o.toLowerCase() === owner.toLowerCase())) {
    res.status(403).send('Forbidden: Only camofy and MetaCubeX repositories are allowed.');
    return;
  }

  // target: https://github.com/<path>
  // Preserve query parameters from the original request if any (excluding the 'path' param itself which we consumed)
  // req.url contains the rewritten URL e.g. /api/proxy?path=...
  // But we want the original query params if the user did /foo?bar=baz
  // The 'path' param in query comes from the rewrite.
  // Any other params in req.query are from the original URL? 
  // In Vercel, query params from the URL are merged into req.query.
  
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path' || key === 'gh_token' || key === 'token') {
      continue;
    }
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.append(key, value);
      }
    }
  }
  const searchString = searchParams.toString();
  const targetUrl = `${baseUrl}/${pathStr}${searchString ? '?' + searchString : ''}`;

  console.log('Forwarding to:', targetUrl);

  try {
    // Optional GitHub token to increase rate limit
    let githubToken: string | undefined;

    const headerToken = req.headers['x-github-token'];
    if (Array.isArray(headerToken)) {
      githubToken = headerToken[0];
    } else if (typeof headerToken === 'string') {
      githubToken = headerToken;
    }

    if (!githubToken) {
      const queryToken = (req.query['gh_token'] ?? req.query['token']) as
        | string
        | string[]
        | undefined;
      if (Array.isArray(queryToken)) {
        githubToken = queryToken[0];
      } else if (typeof queryToken === 'string') {
        githubToken = queryToken;
      }
    }

    if (!githubToken && process.env.GITHUB_TOKEN) {
      githubToken = process.env.GITHUB_TOKEN;
    }

    // Prepare headers to forward
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (
        key === 'host' ||
        key === 'x-github-token' ||
        key.startsWith('x-vercel-') ||
        key.startsWith('x-forwarded-') ||
        !value
      ) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else {
        headers.append(key, value);
      }
    }

    if (githubToken) {
      headers.set('authorization', `token ${githubToken}`);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      // @ts-ignore: Readable.toWeb is available in Node 18+
      body: (req.method !== 'GET' && req.method !== 'HEAD') ? Readable.toWeb(req) : undefined,
      redirect: 'follow',
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
       if (key === 'content-encoding' || key === 'content-length' || key === 'transfer-encoding') return;
       res.setHeader(key, value);
    });

    res.status(response.status);

    if (response.body) {
        // @ts-ignore: Readable.fromWeb is available in Node 18+
        Readable.fromWeb(response.body).pipe(res);
    } else {
        res.end();
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).send('Internal Server Error');
  }
}
