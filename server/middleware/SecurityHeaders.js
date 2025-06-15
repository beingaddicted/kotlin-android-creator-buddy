
class SecurityHeaders {
  static apply(app) {
    // Security headers middleware
    app.use((req, res, next) => {
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Referrer policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Content Security Policy
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;"
      );
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      next();
    });
  }

  static validateOrigin(allowedOrigins = []) {
    return (req, res, next) => {
      const origin = req.get('Origin');
      
      if (!origin) {
        return next();
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        return next();
      }

      return res.status(403).json({ error: 'Origin not allowed' });
    };
  }
}

module.exports = SecurityHeaders;
