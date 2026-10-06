import { CONTENT_SECURITY_POLICY } from './csp';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export default {
  async fetch(request: Request, env: { ASSETS: AssetsBinding }): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    // Every page with the screens' policy (worker/csp.ts); scripts, styles
    // and images as they are.
    if (!(response.headers.get('Content-Type') ?? '').includes('text/html')) return response;
    const page = new Response(response.body, response);
    page.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    return page;
  },
};
