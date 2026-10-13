// -----------------------------------------------------------------------------
// HTTPS transport to the Bbox.
//
// The Bbox serves its local API at https://mabbox.bytel.fr/api/v1 with a
// certificate issued for that name by a public authority. The name only
// resolves through the box's own DNS server, so the integration connects to
// the configured address (192.168.1.254 by default) and checks the certificate
// against mabbox.bytel.fr: SNI and host name verification both use that name,
// whatever address the socket opens. Verification is never relaxed silently:
// only the `tls_verify: insecure` setting turns it off, for the boxes whose
// certificate chain Node cannot validate (see docs/en.md, "Certificate").
//
// A transport is a function `({ method, path, headers, body }) => { status,
// headers, body }`; the tests replace it with an in-memory Bbox.
// -----------------------------------------------------------------------------

import https from 'node:https';
import { BBOX_HOSTNAME } from '../config.js';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * @param {{ host: string, tlsVerify: boolean }} options
 */
export function createHttpsTransport({ host, tlsVerify }) {
  const agent = new https.Agent({ keepAlive: true, maxSockets: 2 });
  return function transport({ method, path, headers = {}, body }) {
    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          host,
          port: 443,
          method,
          path,
          agent,
          servername: BBOX_HOSTNAME,
          rejectUnauthorized: tlsVerify,
          headers: { Host: BBOX_HOSTNAME, ...headers },
          timeout: REQUEST_TIMEOUT_MS,
        },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            }),
          );
          response.on('error', reject);
        },
      );
      request.on('timeout', () =>
        request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })),
      );
      request.on('error', reject);
      if (body !== undefined) {
        request.write(body);
      }
      request.end();
    });
  };
}
