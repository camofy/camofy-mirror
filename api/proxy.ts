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
  const owner = parts[0];
  const allowedOwners = ['camofy', 'MetaCubeX'];

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
    if (key !== 'path') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.append(key, value);
      }
    }
  }
  const searchString = searchParams.toString();
  const targetUrl = `https://github.com/${pathStr}${searchString ? '?' + searchString : ''}`;

  console.log('Forwarding to:', targetUrl);

  try {
    // Prepare headers to forward
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (key !== 'host' && !key.startsWith('x-vercel-') && !key.startsWith('x-forwarded-') && value) {
         if (Array.isArray(value)) {
           value.forEach(v => headers.append(key, v));
         } else {
           headers.append(key, value);
         }
      }
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

