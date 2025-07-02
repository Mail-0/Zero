import { z } from 'zod';

export const aviatoSearchInput = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export const aviatoCompanySearchInput = z.object({
  domain: z.string().optional(),
  companyName: z.string().optional(),
});

export type AviatoSearchInput = z.infer<typeof aviatoSearchInput>;
export type AviatoCompanySearchInput = z.infer<typeof aviatoCompanySearchInput>;

export function isBusinessEmail(email: string): boolean {
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
    'ymail.com', 'rocketmail.com', 'protonmail.com', 'tutanota.com',
    'fastmail.com', 'zoho.com', 'mail.com', 'gmx.com', 'web.de'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? !personalDomains.includes(domain) : false;
}

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

export async function searchCompany(input: AviatoCompanySearchInput, apiKey: string) {
  let dslQuery: any = {
    offset: 0,
    limit: 10,
    sort: [],
  };

  if (input.companyName) {
    dslQuery.nameQuery = input.companyName;
  } else if (input.domain) {
    const domainWithoutTLD = input.domain.replace(/\.(com|org|net|io|co|so|ai|ly|app)$/, '');
    dslQuery.nameQuery = domainWithoutTLD;
  }

  try {
    const response = await fetch('https://data.api.aviato.co/company/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dsl: dslQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aviato company search failed: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as any;
    
    if (input.domain && Array.isArray(json.items)) {
      const domainStr = input.domain;
      const root = domainStr.replace(/\.(com|org|net|io|co|so|ai|ly|app)$/i, '').toLowerCase();

      const scored = (json.items as any[]).map((company) => {
        let score = 0;

        const website = company.URLs?.website?.toLowerCase() || '';
        if (website.includes(domainStr.toLowerCase())) {
          score += 5;
        }

        if (!score && website.includes(root)) {
          score += 3;
        }

        const name = (company.name || '').toLowerCase();
        if (name === root || name.includes(root)) {
          score += 2;
        }

        if (company.country?.toLowerCase() === 'united states') {
          score += 1;
        }

        return { company, score } as { company: any; score: number };
      });

      scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

      if (scored.length && scored[0].score > 0) {
        return { ...json, items: [scored[0].company, ...scored.slice(1).map((s) => s.company)] };
      }
    }

    return json;
  } catch (error) {
    console.error('Aviato company search error:', error);
    throw error;
  }
}

export async function searchPerson(input: AviatoSearchInput, apiKey: string) {
  let dslQuery: any = {
    offset: 0,
    limit: 10,
    sort: [],
  };

  if (input.name) {
    dslQuery.nameQuery = input.name;
  }

  if (input.email) {
    dslQuery.filters = [
      {
        AND: [
          {
            email: {
              operation: 'eq',
              value: input.email,
            },
          },
        ],
      },
    ];
  }

  try {
    const response = await fetch('https://data.api.aviato.co/person/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dsl: dslQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 400 && errorText.includes('Invalid attribute in filter') && input.email) {
        console.warn('Aviato email filter not supported, retrying without email filter');
        
        const { filters, ...dslWithoutFilters } = dslQuery;
        
        const retryResponse = await fetch('https://data.api.aviato.co/person/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dsl: dslWithoutFilters }),
        });
        
        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          throw new Error(`Aviato person search failed: ${retryResponse.status} ${retryErrorText}`);
        }
        
        const json = (await retryResponse.json()) as any;
        return processPersonSearchResults(json, input.email);
      }
      
      throw new Error(`Aviato person search failed: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as any;
    return processPersonSearchResults(json, input.email);
  } catch (error) {
    console.error('Aviato person search error:', error);
    throw error;
  }
}

function processPersonSearchResults(json: any, searchEmail?: string) {
  if (!searchEmail || !json.items) {
    return json;
  }

  const persons = json.items;
  const exactEmailMatch = persons.find((person: any) => 
    person.emails?.some((email: string) => 
      email.toLowerCase() === searchEmail.toLowerCase()
    )
  );

  if (exactEmailMatch) {
    const otherPersons = persons.filter((person: any) => person !== exactEmailMatch);
    return {
      ...json,
      items: [exactEmailMatch, ...otherPersons]
    };
  }

  return json;
}

export async function enrichCompany(identifier: { id?: string; website?: string }, apiKey: string) {
  const params = new URLSearchParams();
  if (identifier.id) params.append('id', identifier.id);
  if (identifier.website) params.append('website', identifier.website);

  const url = `https://data.api.aviato.co/company?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aviato company enrich failed: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as any;
    return json;
  } catch (error) {
    console.error('Aviato enrich company error:', error);
    throw error;
  }
}

export async function enrichPerson(email: string, apiKey: string) {
  try {
    const response = await fetch('https://data.api.aviato.co/person/enrich', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aviato person enrich failed: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as any;
    return json;
  } catch (error) {
    console.error('Aviato enrich person error:', error);
    throw error;
  }
} 