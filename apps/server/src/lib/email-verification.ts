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

async function validateSPF(domain: string, ip: string): Promise<boolean> {
  try {
    const txtRecords = await dns.resolveTxt(domain);
    const spfRecord = txtRecords.flat().find(record => record.startsWith('v=spf1'));
    
    if (!spfRecord) return false;
    
    const mechanisms = spfRecord.split(/\s+/).slice(1);
    const visited = new Set<string>();
    
    const checkMechanism = async (mech: string, currentDomain: string): Promise<boolean> => {
      if (visited.has(currentDomain)) return false;
      visited.add(currentDomain);
      
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
        const [ipRange] = mech.slice(4).split('/');
        if (ip.includes(':')) {
          return ip.toLowerCase().startsWith(ipRange.toLowerCase());
        }
      }
      
      if (mech.startsWith('include:')) {
        const includeDomain = mech.slice(8);
        try {
          const includeRecords = await dns.resolveTxt(includeDomain);
          const includeSpf = includeRecords.flat().find(r => r.startsWith('v=spf1'));
          if (includeSpf) {
            const includeMechs = includeSpf.split(/\s+/).slice(1);
            for (const includeMech of includeMechs) {
              if (await checkMechanism(includeMech, includeDomain)) return true;
            }
          }
        } catch (e) {
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

async function validateDKIM(rawEmail: string): Promise<boolean> {
  try {
    const dkimHeader = getHeader(rawEmail, 'DKIM-Signature');
    if (!dkimHeader) return false;
    
    const params = parseParams(dkimHeader);
    const { d: domain, s: selector, b: signature, bh: bodyHash, h: headers, a: algorithm } = params;
    
    if (!domain || !selector || !signature || !bodyHash || !headers) return false;
    
    if (algorithm !== 'rsa-sha256') return false;
    
    const keyRecord = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
    const keyString = keyRecord.flat().join('');
    const pubKeyMatch = keyString.match(/p=([^;]+)/);
    if (!pubKeyMatch) return false;
    
    const pubKey = pubKeyMatch[1];
    
    const [, body] = rawEmail.split(/\r?\n\r?\n/, 2);
    const bodyToHash = body || '';
    const computedBodyHash = createHash('sha256').update(bodyToHash.replace(/\r?\n$/, '\r\n')).digest('base64');
    
    if (computedBodyHash !== bodyHash) return false;
    
    const headerList = headers.split(':').map(h => h.trim());
    const canonicalizedHeaders = headerList.map(headerName => {
      const headerValue = getHeader(rawEmail, headerName);
      return `${headerName.toLowerCase()}:${headerValue}`;
    }).join('\r\n');
    
    const dkimCanonical = `dkim-signature:${dkimHeader.replace(/\sb=[^;]+/, ' b=')}`;
    const signatureInput = `${canonicalizedHeaders}\r\n${dkimCanonical}`;
    
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signatureInput);
    verifier.end();
    
    const pemKey = `-----BEGIN PUBLIC KEY-----\n${pubKey}\n-----END PUBLIC KEY-----`;
    return verifier.verify(pemKey, signature, 'base64');
    
  } catch (error) {
    return false;
  }
}

async function validateDMARC(domain: string): Promise<boolean> {
  try {
    const txtRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = txtRecords.flat().find(record => record.startsWith('v=DMARC1'));
    
    if (!dmarcRecord) return false;
    
    const params = parseParams(dmarcRecord);
    const policy = params.p;
    
    return policy === 'quarantine' || policy === 'reject';
    
  } catch (error) {
    return false;
  }
}

async function getBIMILogo(domain: string): Promise<string | undefined> {
  try {
    const txtRecords = await dns.resolveTxt(`default._bimi.${domain}`);
    const bimiRecord = txtRecords.flat().find(record => record.includes('v=BIMI1'));
    
    if (!bimiRecord) return undefined;
    
    const params = parseParams(bimiRecord);
    const logoUrl = params.l;
    const vmcUrl = params.a;
    
    console.log(`[BIMI_VERIFICATION] Found BIMI record for ${domain}: logo=${logoUrl}, vmc=${vmcUrl}`);
    
    if (vmcUrl && vmcUrl.startsWith('https://')) {
      const isVmcValid = await validateVMC(vmcUrl, domain);
      console.log(`[BIMI_VERIFICATION] VMC validation for ${domain}: ${isVmcValid}`);
      
      if (!isVmcValid) {
        console.log(`[BIMI_VERIFICATION] VMC validation failed for ${domain}, rejecting logo`);
        return undefined;
      }
    }
    
    if (logoUrl && logoUrl.startsWith('https://')) {
      const isLogoValid = await validateLogoUrl(logoUrl);
      console.log(`[BIMI_VERIFICATION] Logo validation for ${domain}: ${isLogoValid}`);
      
      if (isLogoValid) {
        return logoUrl;
      }
    }
    
    return undefined;
    
  } catch (error) {
    console.error(`[BIMI_VERIFICATION] Error for ${domain}:`, error);
    return undefined;
  }
}

async function validateVMC(vmcUrl: string, domain: string): Promise<boolean> {
  try {
    console.log(`[VMC_VALIDATION] Fetching VMC from: ${vmcUrl}`);
    
    const response = await fetch(vmcUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Zero-Email-Verifier/1.0',
      },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      console.log(`[VMC_VALIDATION] Failed to fetch VMC: ${response.status}`);
      return false;
    }
    
    const vmcContent = await response.text();
    
    const containsDomain = vmcContent.includes(domain);
    const isValidCertificate = vmcContent.includes('BEGIN CERTIFICATE') && 
                              vmcContent.includes('END CERTIFICATE');
    
    console.log(`[VMC_VALIDATION] VMC contains domain: ${containsDomain}, is valid cert: ${isValidCertificate}`);
    
    return containsDomain && isValidCertificate;
    
  } catch (error) {
    console.error(`[VMC_VALIDATION] Error validating VMC:`, error);
    return false;
  }
}

async function validateLogoUrl(logoUrl: string): Promise<boolean> {
  try {
    console.log(`[LOGO_VALIDATION] Validating logo URL: ${logoUrl}`);
    
    const response = await fetch(logoUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Zero-Email-Verifier/1.0',
      },
      signal: AbortSignal.timeout(3000),
    });
    
    if (!response.ok) {
      console.log(`[LOGO_VALIDATION] Logo URL not accessible: ${response.status}`);
      return false;
    }
    
    const contentType = response.headers.get('content-type');
    const isValidImageType = contentType && (
      contentType.includes('image/') || 
      contentType.includes('image/svg+xml')
    );
    
    console.log(`[LOGO_VALIDATION] Content-Type: ${contentType}, is valid image: ${isValidImageType}`);
    
    return !!isValidImageType;
    
  } catch (error) {
    console.error(`[LOGO_VALIDATION] Error validating logo URL:`, error);
    return false;
  }
}

export async function verify(rawEmail: string): Promise<{isVerified: boolean; logoUrl?: string}> {
  try {
    const fromHeader = getHeader(rawEmail, 'From');
    const domain = extractDomainFromEmail(fromHeader);
    
    console.log(`[EMAIL_VERIFICATION] Starting verification for domain: ${domain}`);
    
    if (!domain) {
      console.log(`[EMAIL_VERIFICATION] No domain found in From header: ${fromHeader}`);
      return { isVerified: false };
    }

    const receivedHeader = getHeader(rawEmail, 'Received');
    const senderIP = extractIPFromReceived(receivedHeader);
    
    console.log(`[EMAIL_VERIFICATION] Sender IP extracted: ${senderIP || 'none'}`);

    const [spfValid, dkimValid, dmarcValid] = await Promise.all([
      senderIP ? validateSPF(domain, senderIP).catch(error => {
        console.error(`[EMAIL_VERIFICATION] SPF validation failed for ${domain}:`, error);
        return false;
      }) : Promise.resolve(false),
      validateDKIM(rawEmail).catch(error => {
        console.error(`[EMAIL_VERIFICATION] DKIM validation failed for ${domain}:`, error);
        return false;
      }),
      validateDMARC(domain).catch(error => {
        console.error(`[EMAIL_VERIFICATION] DMARC validation failed for ${domain}:`, error);
        return false;
      }),
    ]);

    console.log(`[EMAIL_VERIFICATION] Email auth results for ${domain}: SPF=${spfValid}, DKIM=${dkimValid}, DMARC=${dmarcValid}`);

    const emailAuthPassed = dkimValid || spfValid || dmarcValid;
    
    if (!emailAuthPassed) {
      console.log(`[EMAIL_VERIFICATION] Domain ${domain} failed email authentication - no verification`);
      return { isVerified: false };
    }

    console.log(`[EMAIL_VERIFICATION] Email auth passed for ${domain}, checking logo ownership...`);
    const logoUrl = await getBIMILogo(domain);
    
    if (!logoUrl) {
      console.log(`[EMAIL_VERIFICATION] Domain ${domain} does not own their profile photo/logo - no verification despite passing email auth`);
      return { isVerified: false };
    }

    console.log(`[EMAIL_VERIFICATION] Domain ${domain} verified successfully with owned logo: ${logoUrl}`);
    return {
      isVerified: true,
      logoUrl,
    };

  } catch (error) {
    console.error('Email verification error:', error);
    return { isVerified: false };
  }
} 