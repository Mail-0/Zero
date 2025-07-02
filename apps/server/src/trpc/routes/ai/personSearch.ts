import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { activeDriverProcedure } from '../../trpc';
import { 
  searchPerson, 
  aviatoSearchInput, 
  searchCompany, 
  aviatoCompanySearchInput,
  isBusinessEmail,
  extractDomain,
  enrichCompany,
  enrichPerson,
} from '../../../lib/aviato';

export const personSearch = activeDriverProcedure
  .input(aviatoSearchInput)
  .mutation(async ({ input }) => {
    const apiKey = (env?.AVIATO_API_KEY as string | undefined) || process.env.AVIATO_API_KEY;

    if (!apiKey) {
      throw new Error('AVIATO_API_KEY is not configured');
    }

    const result = await searchPerson(input, apiKey);
    return result;
  });

export const companySearch = activeDriverProcedure
  .input(aviatoCompanySearchInput)
  .mutation(async ({ input }) => {
    const apiKey = (env?.AVIATO_API_KEY as string | undefined) || process.env.AVIATO_API_KEY;

    if (!apiKey) {
      throw new Error('AVIATO_API_KEY is not configured');
    }

    const result = await searchCompany(input, apiKey);
    return result;
  });

export const smartSearch = activeDriverProcedure
  .input(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const apiKey = (env?.AVIATO_API_KEY as string | undefined) || process.env.AVIATO_API_KEY;

    if (!apiKey) {
      throw new Error('AVIATO_API_KEY is not configured');
    }

    const isBusiness = isBusinessEmail(input.email);
    
    if (isBusiness) {
      const domain = extractDomain(input.email);
      
      try {
        let enriched: any = null;
        try {
          enriched = await enrichCompany({ website: domain }, apiKey);
          if (enriched?.lookupSuccessful && enriched?.company) {
            console.log(`Company enriched successfully for ${domain}`);
            return {
              type: 'company' as const,
              data: null,
              enriched,
              searchedDomain: domain,
            };
          }
        } catch (err) {
          console.warn(`Company enrich failed for ${domain}:`, err);
        }

        console.log(`Falling back to company search for ${domain}`);
        const companyResult = await searchCompany({ domain }, apiKey);

        if (companyResult.items && companyResult.items.length > 0) {
          const topCompany = companyResult.items[0];
          try {
            enriched = await enrichCompany({ id: topCompany.id }, apiKey);
          } catch (err) {
            console.warn('Company enrich by ID failed:', err);
          }
        }

        if (!companyResult.items || companyResult.items.length === 0) {
          console.log(`No company found for ${domain}, trying person enrich as fallback`);
          let personEnriched: any = null;
          try {
            personEnriched = await enrichPerson(input.email, apiKey);
            if (personEnriched?.lookupSuccessful && personEnriched?.person) {
              return {
                type: 'person' as const,
                data: null,
                enriched: personEnriched,
                searchedDomain: domain,
                fallbackFromCompany: true,
              };
            }
          } catch (err) {
            console.warn('Person enrich failed:', err);
          }

          console.log(`Person enrich failed; falling back to person search for ${input.email}`);
          const personResult = await searchPerson(input, apiKey);
          return {
            type: 'person' as const,
            data: personResult,
            enriched: null,
            searchedDomain: domain,
            fallbackFromCompany: true,
          };
        }

        return {
          type: 'company' as const,
          data: companyResult,
          enriched,
          searchedDomain: domain,
        };
        
      } catch (error) {
        console.error('Company search failed:', error);
        throw new Error(`Failed to search for company: ${error}`);
      }
    } else {
      try {
        let enriched: any = null;
        try {
          enriched = await enrichPerson(input.email, apiKey);
          if (enriched?.lookupSuccessful && enriched?.person) {
            console.log(`Person enriched successfully for ${input.email}`);
            return {
              type: 'person' as const,
              data: null,
              enriched,
            };
          }
        } catch (err) {
          console.warn(`Person enrich failed for ${input.email}:`, err);
        }

        console.log(`Falling back to person search for ${input.email}`);
        const personResult = await searchPerson(input, apiKey);
        
        return {
          type: 'person' as const,
          data: personResult,
          enriched: null,
        };
        
      } catch (error) {
        console.error('Person search failed:', error);
        throw new Error(`Failed to search for person: ${error}`);
      }
    }
  });