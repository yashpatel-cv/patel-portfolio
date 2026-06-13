# Shared response headers, included inside every `location` block that
# also sets its own Cache-Control. nginx only inherits add_header
# directives from a parent context when the child context defines none
# of its own -- a location with `add_header Cache-Control ...` silently
# drops these unless they're repeated there too. (review #29)
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
