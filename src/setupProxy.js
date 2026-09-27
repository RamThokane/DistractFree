const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    next();
  });

  // Dev only: forward /api to the local backend, so the app works through a
  // tunnel / on other devices with a relative REACT_APP_API_URL=/api.
  // The browser request is same-origin here, so drop the tunnel's Origin
  // header (the backend's CORS list only knows localhost).
  app.use(
    createProxyMiddleware({
      pathFilter: '/api',
      target: 'http://localhost:5000',
      on: {
        proxyReq: (proxyReq) => proxyReq.removeHeader('origin'),
      },
    })
  );
};
