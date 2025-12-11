const allowedOwners = ['camofy', 'MetaCubeX'];

export default {
  async fetch(request: Request, env: { GITHUB_TOKEN?: string }): Promise<Response> {
    const url = new URL(request.url);
    const pathStr = url.pathname.replace(/^\/+/, '');

    console.log('Proxy hit, path =', pathStr);

    if (!pathStr) {
      return new Response('Path is required', { status: 400 });
    }

    const parts = pathStr.split('/');

    let owner: string | undefined;
    let baseUrl = 'https://github.com';

    if (parts[0] === 'repos') {
      owner = parts[1];
      baseUrl = 'https://api.github.com';
    } else {
      owner = parts[0];
    }

    if (!owner || !allowedOwners.some((o) => o.toLowerCase() === owner!.toLowerCase())) {
      return new Response('Forbidden: Only camofy and MetaCubeX repositories are allowed.', { status: 403 });
    }

    const searchParams = new URLSearchParams(url.searchParams);
    searchParams.delete('gh_token');
    searchParams.delete('token');

    const searchString = searchParams.toString();
    const targetUrl = `${baseUrl}/${pathStr}${searchString ? `?${searchString}` : ''}`;

    console.log('Forwarding to:', targetUrl);

    try {
      // Optional GitHub token to increase rate limit
      let githubToken: string | undefined;

      const headerToken = request.headers.get('x-github-token');
      if (headerToken) {
        githubToken = headerToken;
      }

      if (!githubToken) {
        const queryToken = url.searchParams.get('gh_token') ?? url.searchParams.get('token');
        if (queryToken) {
          githubToken = queryToken;
        }
      }

      if (!githubToken && env.GITHUB_TOKEN) {
        githubToken = env.GITHUB_TOKEN;
      }

      const headers = new Headers();
      request.headers.forEach((value, key) => {
        if (
          key === 'host' ||
          key === 'x-github-token' ||
          key.startsWith('cf-') ||
          key.startsWith('x-forwarded-')
        ) {
          return;
        }
        headers.append(key, value);
      });

      if (githubToken) {
        headers.set('authorization', `token ${githubToken}`);
      }

      const method = request.method.toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';

      const response = await fetch(targetUrl, {
        method,
        headers,
        body: hasBody ? request.body : null,
        redirect: 'follow',
      });

      const respHeaders = new Headers(response.headers);
      respHeaders.delete('content-encoding');
      respHeaders.delete('content-length');
      respHeaders.delete('transfer-encoding');

      return new Response(response.body, {
        status: response.status,
        headers: respHeaders,
      });
    } catch (err) {
      console.error('Proxy error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
