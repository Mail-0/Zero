import { router, privateProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const parseBimiRecord = (record: string) => {
  const parts = record.split(';').map((part) => part.trim());
  const result: { version?: string; logoUrl?: string; authorityUrl?: string } = {};

  for (const part of parts) {
    if (part.startsWith('v=')) {
      result.version = part.substring(2);
    } else if (part.startsWith('l=')) {
      result.logoUrl = part.substring(2);
    } else if (part.startsWith('a=')) {
      result.authorityUrl = part.substring(2);
    }
  }

  return result;
};

const fetchDnsRecord = async (domain: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=default._bimi.${domain}&type=TXT`,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      Status: number;
      Answer?: Array<{ data: string }>;
    };

    if (data.Status !== 0 || !data.Answer || data.Answer.length === 0) {
      return null;
    }

    const bimiRecord = data.Answer.find((answer) => answer.data.includes('v=BIMI1'));

    if (!bimiRecord) {
      return null;
    }

    return bimiRecord.data.replace(/"/g, '');
  } catch (error) {
    console.error(`Error fetching BIMI record for ${domain}:`, error);
    return null;
  }
};

const fetchLogoContent = async (logoUrl: string): Promise<string | null> => {
  try {
    const url = new URL(logoUrl);
    if (url.protocol !== 'https:') {
      return null;
    }

    const response = await fetch(logoUrl, {
      headers: {
        Accept: 'image/svg+xml',
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('svg')) {
      return null;
    }

    const svgContent = await response.text();

    if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
      return null;
    }

    return svgContent;
  } catch (error) {
    console.error(`Error fetching logo from ${logoUrl}:`, error);
    return null;
  }
};

export const bimiRouter = router({
  getByEmail: privateProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .output(
      z.object({
        domain: z.string(),
        bimiRecord: z
          .object({
            version: z.string().optional(),
            logoUrl: z.string().optional(),
            authorityUrl: z.string().optional(),
          })
          .nullable(),
        logo: z
          .object({
            url: z.string(),
            svgContent: z.string(),
          })
          .nullable(),
      }),
    )
    .query(async ({ input }) => {
      const domain = input.email.split('@')[1];

      if (!domain) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unable to extract domain from email address',
        });
      }

      const bimiRecordText = await fetchDnsRecord(domain);

      if (!bimiRecordText) {
        return {
          domain,
          bimiRecord: null,
          logo: null,
        };
      }

      const bimiRecord = parseBimiRecord(bimiRecordText);

      let logo = null;
      if (bimiRecord.logoUrl) {
        const svgContent = await fetchLogoContent(bimiRecord.logoUrl);
        if (svgContent) {
          logo = {
            url: bimiRecord.logoUrl,
            svgContent,
          };
        }
      }

      return {
        domain,
        bimiRecord,
        logo,
      };
    }),

  getByDomain: privateProcedure
    .input(
      z.object({
        domain: z.string().min(1),
      }),
    )
    .output(
      z.object({
        domain: z.string(),
        bimiRecord: z
          .object({
            version: z.string().optional(),
            logoUrl: z.string().optional(),
            authorityUrl: z.string().optional(),
          })
          .nullable(),
        logo: z
          .object({
            url: z.string(),
            svgContent: z.string(),
          })
          .nullable(),
      }),
    )
    .query(async ({ input }) => {
      const bimiRecordText = await fetchDnsRecord(input.domain);

      if (!bimiRecordText) {
        return {
          domain: input.domain,
          bimiRecord: null,
          logo: null,
        };
      }

      const bimiRecord = parseBimiRecord(bimiRecordText);

      let logo = null;
      if (bimiRecord.logoUrl) {
        const svgContent = await fetchLogoContent(bimiRecord.logoUrl);
        if (svgContent) {
          logo = {
            url: bimiRecord.logoUrl,
            svgContent,
          };
        }
      }

      return {
        domain: input.domain,
        bimiRecord,
        logo,
      };
    }),
});
