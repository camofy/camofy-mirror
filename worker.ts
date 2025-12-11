const allowedOwners = ['camofy', 'MetaCubeX'];

export default {
  async fetch(request: Request): Promise<Response> {
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

    const searchString = url.searchParams.toString();
    const targetUrl = `${baseUrl}/${pathStr}${searchString ? `?${searchString}` : ''}`;

    console.log('Forwarding to:', targetUrl);

    try {
      const headers = new Headers();
      request.headers.forEach((value, key) => {
        if (key === 'host' || key.startsWith('cf-') || key.startsWith('x-forwarded-')) {
          return;
        }
        headers.append(key, value);
      });

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

