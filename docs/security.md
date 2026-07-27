# Frontend Security Headers

## Overview

The application uses response security headers to reduce the risk of cross-site scripting (XSS), clickjacking, MIME-type confusion, and unauthorized resource loading.

Security headers are applied dynamically in `middleware.ts`.

## Content Security Policy

The application uses a nonce-based Content Security Policy.

The policy includes:

```text
default-src 'self'
script-src 'self' 'nonce-<per-request-nonce>' 'strict-dynamic'
connect-src 'self'
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'