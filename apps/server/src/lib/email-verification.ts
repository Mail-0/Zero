import { promises as dns } from 'dns';
import { createVerify, createHash } from 'crypto';

const getHeader = (raw: string, name: string): string => {
  const regex = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\r?\\n\\S|\\r?\\n\\r?\\n|$)`, 'mi');
  const match = raw.match(regex);
  return match ? match[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
};

const parseParams = (str: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const parts = str.split(';');
  
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=');
    if (key && valueParts.length > 0) {
      params[key.trim().toLowerCase()] = valueParts.join('=').trim();
    }
  }
  
  return params;
};

const extractDomainFromEmail = (email: string): string | null => {
  const match = email.match(/@([^>\s]+)/);
  return match ? match[1].toLowerCase() : null;
};

const extractIPFromReceived = (received: string): string | null => {
  const patterns = [
    /\[([0-9a-fA-F:.]+)\]/,
    /from\s+[^\s]+\s+\(([0-9a-fA-F:.]+)\)/,
    /by\s+[^\s]+\s+\(([0-9a-fA-F:.]+)\)/
  ];
  
  for (const pattern of patterns) {
    const match = received.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

// Default timeout for DNS TXT look-ups (in milliseconds)
const DNS_TIMEOUT_MS = 5000;

// Resolve TXT records with a timeout so that slow DNS responses don't hang the verification pipeline.

const resolveTxtSafe = (hostname: string, timeout = DNS_TIMEOUT_MS): Promise<string[][]> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DNS resolveTxt timeout for ${hostname}`)), timeout);
    dns.resolveTxt(hostname)
      .then((records) => {
        clearTimeout(timer);
        resolve(records);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// IPv6 utils

// Expand an IPv6 address to its full 8×16-bit segment representation
const parseIPv6 = (ip: string): number[] => {
  // Split around the double-colon (can appear at most once)
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - (headParts.length + tailParts.length);
  const zeros = Array(Math.max(0, missing)).fill('0');
  const parts = [...headParts, ...zeros, ...tailParts].map((p) => parseInt(p || '0', 16));
  if (parts.length !== 8 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) {
    throw new Error(`Invalid IPv6 address: ${ip}`);
  }
  return parts;
};

const ipv6ToBigInt = (ip: string): bigint => {
  return parseIPv6(ip).reduce<bigint>((acc, part) => (acc << 16n) + BigInt(part), 0n);
};

// Check if an IPv6 address belongs to the supplied CIDR range.
const ipv6CidrMatch = (ip: string, rangeIp: string, prefix = 128): boolean => {
  if (prefix < 0 || prefix > 128) return false;
  const ipBig = ipv6ToBigInt(ip);
  const rangeBig = ipv6ToBigInt(rangeIp);
  // Build a network mask with the first `prefix` bits set to 1
  const networkMask = prefix === 0 ? 0n : (((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix));
  return (ipBig & networkMask) === (rangeBig & networkMask);
};

// SPF Validation
async function validateSPF(domain: string, ip: string): Promise<boolean> {
  try {
    const txtRecords = await resolveTxtSafe(domain);
    const spfRecord = txtRecords.flat().find(record => record.startsWith('v=spf1'));
    
    if (!spfRecord) return false;
    
    const mechanisms = spfRecord.split(/\s+/).slice(1);
    const visited = new Set<string>();
    
    const checkMechanism = async (mech: string, currentDomain: string): Promise<boolean> => {
      const visitKey = `${currentDomain}:${mech}`;
      if (visited.has(visitKey)) return false;
      visited.add(visitKey);
      
      if (mech === 'all' || mech === '-all' || mech === '~all') return false;
      if (mech === '+all') return true;
      
      if (mech.startsWith('ip4:')) {
        const [ipRange, cidr] = mech.slice(4).split('/');
        if (ip.includes('.')) {
          if (cidr) {
            const mask = parseInt(cidr);
            const ipInt = ipToInt(ip);
            const rangeInt = ipToInt(ipRange);
            const maskInt = (0xFFFFFFFF << (32 - mask)) >>> 0;
            return (ipInt & maskInt) === (rangeInt & maskInt);
          }
          return ip === ipRange;
        }
      }
      
      if (mech.startsWith('ip6:')) {
        const [ipRange, cidr] = mech.slice(4).split('/');
        if (ip.includes(':')) {
          const prefix = cidr ? parseInt(cidr, 10) : 128;
          try {
            return ipv6CidrMatch(ip, ipRange, prefix);
          } catch {
            return false;
          }
        }
      }
      
      if (mech.startsWith('include:')) {
        const includeDomain = mech.slice(8);
        try {
          const includeRecords = await resolveTxtSafe(includeDomain);
          const includeSpf = includeRecords.flat().find(r => r.startsWith('v=spf1'));
          if (includeSpf) {
            const includeMechs = includeSpf.split(/\s+/).slice(1);
            for (const includeMech of includeMechs) {
              if (await checkMechanism(includeMech, includeDomain)) return true;
            }
          }
        } catch (e) {
          // Include domain lookup failed
        }
      }
      
      return false;
    };
    
    for (const mechanism of mechanisms) {
      if (await checkMechanism(mechanism, domain)) return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

// DKIM Validation
async function validateDKIM(rawEmail: string): Promise<boolean> {
  try {
    const dkimHeader = getHeader(rawEmail, 'DKIM-Signature');
    if (!dkimHeader) return false;
    
    const params = parseParams(dkimHeader);
    const { d: domain, s: selector, b: signature, bh: bodyHash, h: headers, a: algorithm } = params;
    
    if (!domain || !selector || !signature || !bodyHash || !headers) return false;
    
    if (algorithm !== 'rsa-sha256') return false;
    
    // Get public key
    const keyRecord = await resolveTxtSafe(`${selector}._domainkey.${domain}`);
    const keyString = keyRecord.flat().join('');
    const pubKeyMatch = keyString.match(/p=([^;]+)/);
    if (!pubKeyMatch) return false;
    
    const pubKey = pubKeyMatch[1];
    
    // Extract and verify body hash
    const [, body] = rawEmail.split(/\r?\n\r?\n/, 2);
    const bodyToHash = body || '';
    const computedBodyHash = createHash('sha256').update(bodyToHash.replace(/\r?\n$/, '\r\n')).digest('base64');
    
    if (computedBodyHash !== bodyHash) return false;
    
    // Create signature input
    const headerList = headers.split(':').map(h => h.trim());
    const canonicalizedHeaders = headerList.map(headerName => {
      const headerValue = getHeader(rawEmail, headerName);
      return `${headerName.toLowerCase()}:${headerValue}`;
    }).join('\r\n');
    
    const dkimCanonical = `dkim-signature:${dkimHeader.replace(/\sb=[^;]+/, ' b=')}`;
    const signatureInput = `${canonicalizedHeaders}\r\n${dkimCanonical}`;
    
    // Verify signature
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signatureInput);
    verifier.end();
    
    const pemKey = `-----BEGIN PUBLIC KEY-----\n${pubKey}\n-----END PUBLIC KEY-----`;
    return verifier.verify(pemKey, signature, 'base64');
    
  } catch (error) {
    return false;
  }
}

// DMARC Validation
async function validateDMARC(domain: string): Promise<boolean> {
  try {
    const txtRecords = await resolveTxtSafe(`_dmarc.${domain}`);
    const dmarcRecord = txtRecords.flat().find(record => record.startsWith('v=DMARC1'));
    
    if (!dmarcRecord) return false;
    
    const params = parseParams(dmarcRecord);
    const policy = params.p;
    
    // Require strict policy (quarantine or reject)
    return policy === 'quarantine' || policy === 'reject';
    
  } catch (error) {
    return false;
  }
}

// BIMI Validation
async function validateBIMI(domain: string): Promise<boolean> {
  try {
    console.log(`[BIMI_DEBUG] Validating BIMI for domain: ${domain}`);
    
    // Try exact domain first
    console.log(`[BIMI_DEBUG] Checking default._bimi.${domain}`);
    try {
      const txtRecords = await resolveTxtSafe(`default._bimi.${domain}`);
      const bimiRecord = txtRecords.flat().find(record => record.includes('v=BIMI1'));
      
      if (bimiRecord) {
        console.log(`[BIMI_DEBUG] Found BIMI record on exact domain: ${bimiRecord}`);
        return await validateBIMIRecord(bimiRecord, domain);
      }
    } catch (exactDomainError) {
      console.log(`[BIMI_DEBUG] No BIMI record on exact domain ${domain}: ${exactDomainError instanceof Error ? exactDomainError.message : String(exactDomainError)}`);
    }
    
    // If no BIMI record on exact domain, try parent domain for subdomains
    const domainParts = domain.split('.');
    console.log(`[BIMI_DEBUG] No BIMI on exact domain. Domain parts: ${domainParts}`);
    if (domainParts.length > 2) {
      const parentDomain = domainParts.slice(-2).join('.');
      console.log(`[BIMI_DEBUG] Checking parent domain: default._bimi.${parentDomain}`);
      try {
        const parentTxtRecords = await resolveTxtSafe(`default._bimi.${parentDomain}`);
        const parentBimiRecord = parentTxtRecords.flat().find(record => record.includes('v=BIMI1'));
        
        if (parentBimiRecord) {
          console.log(`[BIMI_DEBUG] Found BIMI record on parent domain: ${parentBimiRecord}`);
          return await validateBIMIRecord(parentBimiRecord, parentDomain);
        } else {
          console.log(`[BIMI_DEBUG] No BIMI record found on parent domain ${parentDomain}`);
        }
      } catch (parentDomainError) {
        console.log(`[BIMI_DEBUG] Error checking parent domain ${parentDomain}: ${parentDomainError instanceof Error ? parentDomainError.message : String(parentDomainError)}`);
      }
    } else {
      console.log(`[BIMI_DEBUG] Domain ${domain} is not a subdomain, skipping parent check`);
    }
    
    console.log(`[BIMI_DEBUG] BIMI validation failed for ${domain}`);
    return false;
    
  } catch (error) {
    console.error(`[BIMI_DEBUG] Unexpected error validating BIMI for ${domain}:`, error);
    return false;
  }
}

async function validateBIMIRecord(bimiRecord: string, domain: string): Promise<boolean> {
  try {
    const params = parseParams(bimiRecord);
    const logoUrl = params.l;
    const vmcUrl = params.a;
    
    console.log(`[BIMI_DEBUG] Validating BIMI record for ${domain}: logoUrl=${logoUrl}, vmcUrl=${vmcUrl}`);
    
    // Require a valid HTTPS logo URL
    if (!logoUrl || !logoUrl.startsWith('https://')) {
      console.log(`[BIMI_DEBUG] Invalid logo URL for ${domain}: ${logoUrl}`);
      return false;
    }
    
    // If VMC URL is provided, validate it
    if (vmcUrl) {
      if (!vmcUrl.startsWith('https://')) {
        console.log(`[BIMI_DEBUG] Invalid VMC URL for ${domain}: ${vmcUrl}`);
        return false;
      }
      
      // Validate VMC certificate (basic check)
      const vmcValid = await validateVMC(vmcUrl, domain);
      if (!vmcValid) {
        console.log(`[BIMI_DEBUG] VMC validation failed for ${domain}`);
        return false;
      }
    }
    
    // Validate logo accessibility
    const logoValid = await validateLogo(logoUrl, domain);
    if (!logoValid) {
      console.log(`[BIMI_DEBUG] Logo validation failed for ${domain}`);
      return false;
    }
    
    console.log(`[BIMI_DEBUG] BIMI validation successful for ${domain}`);
    return true;
    
  } catch (error) {
    console.log(`[BIMI_DEBUG] Error validating BIMI record for ${domain}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function validateVMC(vmcUrl: string, domain: string): Promise<boolean> {
  try {
    console.log(`[BIMI_DEBUG] Validating VMC for ${domain}: ${vmcUrl}`);
    
    // Basic VMC validation - check if certificate is accessible
    const response = await fetch(vmcUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) 
    });
    
    if (!response.ok) {
      console.log(`[BIMI_DEBUG] VMC not accessible for ${domain}: ${response.status}`);
      return false;
    }
    
    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || (!contentType.includes('application/x-pem-file') && !contentType.includes('application/x-x509-ca-cert') && !contentType.includes('text/plain'))) {
      console.log(`[BIMI_DEBUG] Invalid VMC content type for ${domain}: ${contentType}`);
      return false;
    }
    
    console.log(`[BIMI_DEBUG] VMC validation passed for ${domain}`);
    return true;
    
  } catch (error) {
    console.log(`[BIMI_DEBUG] VMC validation error for ${domain}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function validateLogo(logoUrl: string, domain: string): Promise<boolean> {
  try {
    console.log(`[BIMI_DEBUG] Validating logo for ${domain}: ${logoUrl}`);
    
    // Basic logo validation - check if logo is accessible
    const response = await fetch(logoUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) 
    });
    
    if (!response.ok) {
      console.log(`[BIMI_DEBUG] Logo not accessible for ${domain}: ${response.status}`);
      return false;
    }
    
    // Check content type for SVG
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('image/svg+xml')) {
      console.log(`[BIMI_DEBUG] Invalid logo content type for ${domain}: ${contentType}`);
      return false;
    }
    
    console.log(`[BIMI_DEBUG] Logo validation passed for ${domain}`);
    return true;
    
  } catch (error) {
    console.log(`[BIMI_DEBUG] Logo validation error for ${domain}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function getBIMILogo(domain: string): Promise<string | undefined> {
  try {
    // Try exact domain first
    const txtRecords = await resolveTxtSafe(`default._bimi.${domain}`);
    const bimiRecord = txtRecords.flat().find(record => record.includes('v=BIMI1'));
    
    if (bimiRecord) {
      const params = parseParams(bimiRecord);
      const logoUrl = params.l;
      
      if (logoUrl && logoUrl.startsWith('https://')) {
        return logoUrl;
      }
    }
    
    // If no BIMI record on exact domain, try parent domain for subdomains
    const domainParts = domain.split('.');
    if (domainParts.length > 2) {
      const parentDomain = domainParts.slice(-2).join('.');
      const parentTxtRecords = await resolveTxtSafe(`default._bimi.${parentDomain}`);
      const parentBimiRecord = parentTxtRecords.flat().find(record => record.includes('v=BIMI1'));
      
      if (parentBimiRecord) {
        const params = parseParams(parentBimiRecord);
        const logoUrl = params.l;
        
        if (logoUrl && logoUrl.startsWith('https://')) {
          return logoUrl;
        }
      }
    }
    
    return undefined;
    
  } catch (error) {
    return undefined;
  }
}

// Main verification function
export async function verify(rawEmail: string): Promise<{isVerified: boolean; logoUrl?: string}> {
  try {
    // Extract sender domain
    const fromHeader = getHeader(rawEmail, 'From');
    const domain = extractDomainFromEmail(fromHeader);
    
    if (!domain) {
      return { isVerified: false };
    }

    // Extract sender IP (may not always be available)
    const receivedHeader = getHeader(rawEmail, 'Received');
    const senderIP = extractIPFromReceived(receivedHeader);
    
    // Run validations in parallel
    const [spfValid, dkimValid, dmarcValid, bimiValid] = await Promise.all([
      senderIP ? validateSPF(domain, senderIP).catch(error => {
        return false;
      }) : Promise.resolve(false),
      validateDKIM(rawEmail).catch(error => {
        return false;
      }),
      validateDMARC(domain).catch(error => {
        return false;
      }),
      validateBIMI(domain).catch(error => {
        return false;
      }),
    ]);

    const authValid = dkimValid || spfValid || dmarcValid;
    
    // Gmail requires both email authentication AND BIMI validation btw
    console.log(`[VERIFY_DEBUG] Domain: ${domain}, SPF: ${spfValid}, DKIM: ${dkimValid}, DMARC: ${dmarcValid}, BIMI: ${bimiValid}`);
    const isVerified = authValid && bimiValid;
    console.log(`[VERIFY_DEBUG] Final verification result for ${domain}: ${isVerified} (auth: ${authValid}, bimi: ${bimiValid})`);

    if (isVerified) {
      const logoUrl = await getBIMILogo(domain);
      return {
        isVerified: true,
        logoUrl,
      };
    }

    return { isVerified: false };
  } catch (error) {
    console.error('Email verification error:', error);
    return { isVerified: false };
  }
}