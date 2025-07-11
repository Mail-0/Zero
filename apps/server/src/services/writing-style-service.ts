import { mapToObj, pipe, entries, sortBy, take, fromEntries } from 'remeda';

import { writingStyleMatrix } from '../db/schema';


import { env } from 'cloudflare:workers';
import { google } from '@ai-sdk/google';
import { jsonrepair } from 'jsonrepair';
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import pRetry from 'p-retry';
import { z } from 'zod';

// leaving these in here for testing between them
// (switching to `k` will surely truncate what `coverage` was keeping)
const TAKE_TOP_K = 12;

// Using Welford Variance Algorithm (https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance)
// Welford’s online algorithm continuously updates the running mean and variance using just three
// numbers—sample count, current mean, and cumulative squared deviation (M₂). Therefore, each new value
// can be processed the moment it arrives, with no need to store earlier data, while maintaining high
// numerical accuracy.
export const MEAN_METRIC_KEYS = [
  'averageSentenceLength', // average number of words per sentence
  'averageLinesPerParagraph', // average number of lines per paragraph
  'averageWordLength', // average number of characters per token
  'typeTokenRatio', // lexical-diversity ratio (unique/total)
  'movingAverageTtr', // MTLD lexical-diversity metric
  'hapaxProportion', // share of words that appear exactly once
  'shannonEntropy', // entropy of unigram distribution
  'lexicalDensity', // content words divided by total words
  'contractionRate', // apostrophe contractions per 1 000 tokens
  'subordinationRatio', // subordinate clauses ÷ total clauses
  'passiveVoiceRate', // passive sentences per 1 000 tokens
  'modalVerbRate', // modals like “could” per 1 000 tokens
  'parseTreeDepthMean', // mean depth of constituency parse trees
  'commasPerSentence', // commas per sentence
  'exclamationPerThousandWords', // “!” per 1 000 tokens
  'questionMarkRate', // “?” per 1 000 tokens
  'ellipsisRate', // “…” per 1 000 tokens
  'parenthesesRate', // parentheses per 1 000 tokens
  'emojiRate', // emoji per 1 000 tokens
  'sentimentPolarity', // −1 negative … 1 positive
  'sentimentSubjectivity', // 0 objective … 1 subjective
  'formalityScore', // 0 casual … 100 formal
  'hedgeRate', // hedges per 1 000 tokens
  'certaintyRate', // certainty markers per 1 000 tokens
  'fleschReadingEase', // Flesch reading-ease score
  'gunningFogIndex', // Gunning-Fog readability index
  'smogIndex', // SMOG readability index
  'averageForwardReferences', // forward references per sentence
  'cohesionIndex', // semantic cohesion 0–1
  'firstPersonSingularRate', // “I/me/my” per 1 000 tokens
  'firstPersonPluralRate', // “we/our/us” per 1 000 tokens
  'secondPersonRate', // “you/your” per 1 000 tokens
  'selfReferenceRatio', // first-person pronouns ÷ total pronouns
  'empathyPhraseRate', // empathic phrases per 1 000 tokens
  'humorMarkerRate', // humour markers per 1 000 tokens
  'markupBoldRate', // **bold** markers per 1 000 tokens
  'markupItalicRate', // *italic* markers per 1 000 tokens
  'hyperlinkRate', // hyperlinks per 1 000 tokens
  'codeBlockRate', // fenced code blocks per 1 000 tokens
  'rhetoricalQuestionRate', // rhetorical “?” per 1 000 tokens
  'analogyRate', // analogies per 1 000 tokens
  'imperativeSentenceRate', // imperatives per 1 000 tokens
  'expletiveOpeningRate', // openings like “there is” per 1 000 tokens
  'parallelismRate', // parallel syntactic patterns per 1 000 tokens
] as const;

export const SUM_METRIC_KEYS = [
  'tokenTotal', // total tokens in the email body
  'charTotal', // total characters in the body
  'paragraphs', // number of paragraph blocks
  'bulletListPresent', // 1 if any bullet/numbered list present, else 0
  'greetingPresent', // 1 if greeting line present, else 0
  'signOffPresent', // 1 if sign-off line present, else 0
] as const;

export const TOP_COUNTS_KEYS = [
  'greetingForm', // most-used greeting phrase → frequency map
  'signOffForm', // most-used sign-off phrase → frequency map
] as const;

const schema = z.object({
  /* greeting & sign-off */
  greetingForm: z.string(), // empty string if absent
  signOffForm: z.string(),
  greetingPresent: z.number().int().min(0).max(1),
  signOffPresent: z.number().int().min(0).max(1),

  /* simple totals & flags */
  tokenTotal: z.number().int().nonnegative(),
  charTotal: z.number().int().nonnegative(),
  paragraphs: z.number().int().nonnegative(),
  bulletListPresent: z.number().int().min(0).max(1),

  /* structural averages */
  averageSentenceLength: z.number().nonnegative(),
  averageLinesPerParagraph: z.number().nonnegative(),
  averageWordLength: z.number().nonnegative(),

  /* vocabulary & diversity */
  typeTokenRatio: z.number().min(0).max(1),
  movingAverageTtr: z.number().min(0),
  hapaxProportion: z.number().min(0).max(1),
  shannonEntropy: z.number().min(0),
  lexicalDensity: z.number().min(0).max(1),
  contractionRate: z.number().min(0), // per-1000-token rate

  /* syntax & grammar */
  subordinationRatio: z.number().min(0).max(1),
  passiveVoiceRate: z.number().min(0),
  modalVerbRate: z.number().min(0),
  parseTreeDepthMean: z.number().min(0),

  /* punctuation & symbols */
  commasPerSentence: z.number().min(0),
  exclamationPerThousandWords: z.number().min(0),
  questionMarkRate: z.number().min(0),
  ellipsisRate: z.number().min(0),
  parenthesesRate: z.number().min(0),
  emojiRate: z.number().min(0),

  /* tone */
  sentimentPolarity: z.number().min(-1).max(1),
  sentimentSubjectivity: z.number().min(0).max(1),
  formalityScore: z.number().min(0).max(100),
  hedgeRate: z.number().min(0),
  certaintyRate: z.number().min(0),

  /* readability & flow */
  fleschReadingEase: z.number(),
  gunningFogIndex: z.number(),
  smogIndex: z.number(),
  averageForwardReferences: z.number().min(0),
  cohesionIndex: z.number().min(0).max(1),

  /* persona markers */
  firstPersonSingularRate: z.number().min(0),
  firstPersonPluralRate: z.number().min(0),
  secondPersonRate: z.number().min(0),
  selfReferenceRatio: z.number().min(0).max(1),
  empathyPhraseRate: z.number().min(0),
  humorMarkerRate: z.number().min(0),

  /* formatting habits */
  markupBoldRate: z.number().min(0),
  markupItalicRate: z.number().min(0),
  hyperlinkRate: z.number().min(0),
  codeBlockRate: z.number().min(0),

  /* rhetorical devices */
  rhetoricalQuestionRate: z.number().min(0),
  analogyRate: z.number().min(0),
  imperativeSentenceRate: z.number().min(0),
  expletiveOpeningRate: z.number().min(0),
  parallelismRate: z.number().min(0),
});

export const getWritingStyleMatrixForConnectionId = async ({
  connectionId,
  backupContent,
}: {
  connectionId: string;
  backupContent?: string;
}) => {
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

  const matrix = await db.query.writingStyleMatrix.findFirst({
    where: eq(writingStyleMatrix.connectionId, connectionId),
  });

  await conn.end();

  if (!matrix && backupContent) {
    if (!backupContent.trim()) {
      return null;
    }

    const newMatrix = await extractStyleMatrix(backupContent);

    return {
      connectionId,
      numMessages: 1,
      style: initializeStyleMatrixFromEmail(newMatrix),
    };
  }

  return matrix;
};

export const updateWritingStyleMatrix = async (connectionId: string, emailBody: string) => {
  const emailStyleMatrix = await extractStyleMatrix(emailBody);

  await pRetry(
    async () => {
      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
      await db.transaction(async (tx) => {
        const [existingMatrix] = await tx
          .select({
            numMessages: writingStyleMatrix.numMessages,
            style: writingStyleMatrix.style,
          })
          .from(writingStyleMatrix)
          .where(eq(writingStyleMatrix.connectionId, connectionId));

        if (existingMatrix) {
          const newStyle = createUpdatedMatrixFromNewEmail(
            existingMatrix.numMessages,
            existingMatrix.style as WritingStyleMatrix,
            emailStyleMatrix,
          );

          await tx
            .update(writingStyleMatrix)
            .set({
              numMessages: existingMatrix.numMessages + 1,
              style: newStyle,
            })
            .where(eq(writingStyleMatrix.connectionId, connectionId));
        } else {
          const newStyle = initializeStyleMatrixFromEmail(emailStyleMatrix);

          await tx
            .insert(writingStyleMatrix)
            .values({
              connectionId,
              numMessages: 1,
              style: newStyle,
            })
            .onConflictDoNothing();
        }
      });
      await conn.end();
    },
    {
      retries: 1,
    },
  );
};

export const createUpdatedMatrixFromNewEmail = (
  numMessages: number,
  currentStyleMatrix: WritingStyleMatrix,
  emailStyleMatrix: EmailMatrix,
) => {
  const newStyle = {
    ...currentStyleMatrix,
  };

  for (const key of MEAN_METRIC_KEYS) {
    newStyle[key] = updateWelfordMetric(currentStyleMatrix[key], emailStyleMatrix[key]);
  }

  for (const key of SUM_METRIC_KEYS) {
    newStyle[key] = currentStyleMatrix[key] + emailStyleMatrix[key];
  }

  for (const key of TOP_COUNTS_KEYS) {
    const emailValue = emailStyleMatrix[key];
    if (emailValue) {
      newStyle[key][emailValue] = (newStyle[key][emailValue] ?? 0) + 1;
      newStyle[key] = takeTopK(newStyle[key]);
    }
  }

  return newStyle;
};

const takeTopK = (data: Record<string, number>, k = TAKE_TOP_K) => {
  return pipe(
    data,
    entries(),
    sortBy(([_, count]) => -count),
    take(k),
    fromEntries(),
  );
};

export const initializeStyleMatrixFromEmail = (matrix: EmailMatrix) => {
  const initializedWelfordMetrics = mapToObj(MEAN_METRIC_KEYS, (key) => {
    return [key, initializeWelfordMetric(matrix[key])];
  });

  const initializedSumMetrics = mapToObj(SUM_METRIC_KEYS, (key) => {
    return [key, matrix[key]];
  });

  const initializedTopCountMetrics = mapToObj(TOP_COUNTS_KEYS, (key) => {
    return [key, matrix[key] ? { [matrix[key]]: 1 } : {}];
  });

  return {
    ...initializedWelfordMetrics,
    ...initializedSumMetrics,
    ...initializedTopCountMetrics,
  };
};

const updateWelfordMetric = (previousState: WelfordState, value: number) => {
  const count = previousState.count + 1;
  const delta = value - previousState.mean;
  const mean = previousState.mean + delta / count;
  const m2 = previousState.m2 + delta * (value - mean);

  return {
    count,
    mean,
    m2,
  };
};

const initializeWelfordMetric = (statValue: number) => {
  return {
    count: 1,
    mean: statValue,
    m2: 0,
  };
};

export type WelfordState = {
  count: number;
  mean: number;
  m2: number;
};

export type EmailMatrix = Record<(typeof MEAN_METRIC_KEYS)[number], number> &
  Record<(typeof SUM_METRIC_KEYS)[number], number> &
  Record<(typeof TOP_COUNTS_KEYS)[number], string | null>;

export type WritingStyleMatrix = Record<(typeof MEAN_METRIC_KEYS)[number], WelfordState> &
  Record<(typeof SUM_METRIC_KEYS)[number], number> &
  Record<(typeof TOP_COUNTS_KEYS)[number], Record<string, number>>;

const extractStyleMatrix = async (emailBody: string) => {
  if (!emailBody.trim()) {
    throw new Error('Invalid body provided.');
  }

  const { object: result } = await generateObject({
    model: google('gemini-2.0-flash'),
    schema,
    temperature: 0,
    maxTokens: 600,
    maxRetries: 5,
    system: StyleMatrixExtractorPrompt(),
    prompt: emailBody.trim(),
    experimental_repairText: async ({ text }) => {
      try {
        JSON.parse(text);

        return text;
      } catch {
        try {
          return jsonrepair(text);
        } catch {
          // 3. Fallback – trim to the last complete object/array
          const lastClosing = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));

          return lastClosing !== -1 ? text.slice(0, lastClosing + 1) : text;
        }
      }
    },
  });

  const greeting = result.greetingForm?.trim().toLowerCase();
  const signOff = result.signOffForm?.trim().toLowerCase();
  return {
    ...result,
    greeting: greeting ?? null,
    signOff: signOff ?? null,
    greetingTotal: greeting ? 1 : 0,
    signOffTotal: signOff ? 1 : 0,
  };
};

const StyleMatrixExtractorPrompt = () => `
<system_prompt>
  <role>
    You are <b>StyleMetricExtractor</b>, a deterministic tool that distills
    writing-style metrics from a single email.
  </role>

  <instructions>
    <goal>
      Treat the entire incoming message as one email body, extract every metric
      listed below, and reply with a minified JSON object whose keys appear in
      the exact order shown.
    </goal>

    <tasks>
      <item>Identify and calculate each metric.</item>
      <item>Supply neutral defaults when a metric is absent (string → "", float → 0, int → 0).</item>
      <item>Return only the JSON — no commentary, no extra keys, no whitespace outside the object.</item>
      <item>Ensure all <b>52 metrics</b> appear exactly once, in order, using correct JSON types
            (strings quoted, numbers bare). Do not output NaN, null, or omit any key.</item>
      <item>Guarantee the output parses as valid JSON in every standard parser.
            The braces <code>{ }</code> must be the first and last characters.</item>
    </tasks>

    <!-- ─────────────────────────────────────────────────────── -->
    <!--                     METRIC ORDER                       -->
    <!-- ─────────────────────────────────────────────────────── -->
    <metrics>
      <!-- greeting / sign-off (strings + flags) -->
      <metric key="greetingForm"                type="string"/>
      <metric key="signOffForm"                 type="string"/>
      <metric key="greetingPresent"             type="int"/>
      <metric key="signOffPresent"              type="int"/>

      <!-- simple totals & flags -->
      <metric key="tokenTotal"                  type="int"/>
      <metric key="charTotal"                   type="int"/>
      <metric key="paragraphs"                  type="int"/>
      <metric key="bulletListPresent"           type="int"/>

      <!-- structural averages -->
      <metric key="averageSentenceLength"       type="float"/>
      <metric key="averageLinesPerParagraph"    type="float"/>
      <metric key="averageWordLength"           type="float"/>

      <!-- vocabulary & diversity -->
      <metric key="typeTokenRatio"              type="float"/>
      <metric key="movingAverageTtr"            type="float"/>
      <metric key="hapaxProportion"             type="float"/>
      <metric key="shannonEntropy"              type="float"/>
      <metric key="lexicalDensity"              type="float"/>
      <metric key="contractionRate"             type="float"/>

      <!-- syntax & grammar -->
      <metric key="subordinationRatio"          type="float"/>
      <metric key="passiveVoiceRate"            type="float"/>
      <metric key="modalVerbRate"               type="float"/>
      <metric key="parseTreeDepthMean"          type="float"/>

      <!-- punctuation & symbols -->
      <metric key="commasPerSentence"           type="float"/>
      <metric key="exclamationPerThousandWords" type="float"/>
      <metric key="questionMarkRate"            type="float"/>
      <metric key="ellipsisRate"                type="float"/>
      <metric key="parenthesesRate"             type="float"/>
      <metric key="emojiRate"                   type="float"/>

      <!-- tone -->
      <metric key="sentimentPolarity"           type="float"/>
      <metric key="sentimentSubjectivity"       type="float"/>
      <metric key="formalityScore"              type="float"/>
      <metric key="hedgeRate"                   type="float"/>
      <metric key="certaintyRate"               type="float"/>

      <!-- readability & flow -->
      <metric key="fleschReadingEase"           type="float"/>
      <metric key="gunningFogIndex"             type="float"/>
      <metric key="smogIndex"                   type="float"/>
      <metric key="averageForwardReferences"    type="float"/>
      <metric key="cohesionIndex"               type="float"/>

      <!-- persona markers -->
      <metric key="firstPersonSingularRate"     type="float"/>
      <metric key="firstPersonPluralRate"       type="float"/>
      <metric key="secondPersonRate"            type="float"/>
      <metric key="selfReferenceRatio"          type="float"/>
      <metric key="empathyPhraseRate"           type="float"/>
      <metric key="humorMarkerRate"             type="float"/>

      <!-- formatting habits -->
      <metric key="markupBoldRate"              type="float"/>
      <metric key="markupItalicRate"            type="float"/>
      <metric key="hyperlinkRate"               type="float"/>
      <metric key="codeBlockRate"               type="float"/>

      <!-- rhetorical devices -->
      <metric key="rhetoricalQuestionRate"      type="float"/>
      <metric key="analogyRate"                 type="float"/>
      <metric key="imperativeSentenceRate"      type="float"/>
      <metric key="expletiveOpeningRate"        type="float"/>
      <metric key="parallelismRate"             type="float"/>
    </metrics>

    <!-- ───────────────────────────── -->
    <!--  extraction helper hints      -->
    <!-- ───────────────────────────── -->
    <extraction_guidelines>
      <!-- string fields -->
      <item>greetingForm: first-line salutation up to first comma or emoji; strip names & honorifics; lower-case.</item>
      <item>signOffForm: last line before signature or EOF; lower-case; strip names; keep trailing comma if present.</item>

      <!-- presence flags -->
      <item>greetingPresent / signOffPresent: 1 if respective form ≠ "", else 0.</item>

      <!-- bullets & lists -->
      <item>bulletListPresent: 1 if a line starts with •, –, *, or numeral+“.”.</item>

      <!-- emoji & slang -->
      <item>emojiRate = (emoji ÷ tokens) × 1000. Count only Unicode emoji.</item>
      <item>slang tokens include: vibe, slaps, fam, tbh, legit, lol, omg, hype, flex.</item>

      <!-- punctuation rules -->
      <item>casual punctuation (!!, ?!, ?!!, …) counts toward exclamation or ellipsis metrics respectively.</item>

      <!-- readability / sentiment clamps -->
      <item>Clamp fleschReadingEase to 0–100; sentimentPolarity to −1...1; subjectivity to 0...1.</item>
    </extraction_guidelines>

    <!-- ───────────────────────────── -->
    <!--          examples             -->
    <!-- ───────────────────────────── -->
    <output_format>
      <example_input>
hey jordan 👋

hope your week’s chill! the rollout is pretty much cooked and i wanna be sure it slaps for your crew. got 15 min thurs or fri to hop on a call? drop a time and i’ll toss it on the cal.

catch ya soon,
dak
      </example_input>

      <example_output>
{"greetingForm":"hey","signOffForm":"catch ya soon","greetingPresent":1,"signOffPresent":1,"tokenTotal":63,"charTotal":335,"paragraphs":2,"bulletListPresent":0,"averageSentenceLength":15.75,"averageLinesPerParagraph":3,"averageWordLength":4.24,"typeTokenRatio":0.60,"movingAverageTtr":78.1,"hapaxProportion":0.49,"shannonEntropy":4.66,"lexicalDensity":0.59,"contractionRate":15.87,"subordinationRatio":0.19,"passiveVoiceRate":0,"modalVerbRate":15.87,"parseTreeDepthMean":2.3,"commasPerSentence":0.25,"exclamationPerThousandWords":0,"questionMarkRate":15.87,"ellipsisRate":0,"parenthesesRate":0,"emojiRate":15.87,"sentimentPolarity":0.45,"sentimentSubjectivity":0.55,"formalityScore":28,"hedgeRate":5.08,"certaintyRate":2.54,"fleschReadingEase":75,"gunningFogIndex":7.9,"smogIndex":8.1,"averageForwardReferences":0.2,"cohesionIndex":0.72,"firstPersonSingularRate":31.7,"firstPersonPluralRate":0,"secondPersonRate":15.87,"selfReferenceRatio":0.47,"empathyPhraseRate":3.17,"humorMarkerRate":15.87,"markupBoldRate":0,"markupItalicRate":0,"hyperlinkRate":0,"codeBlockRate":0,"rhetoricalQuestionRate":7.93,"analogyRate":0,"imperativeSentenceRate":15.87,"expletiveOpeningRate":0,"parallelismRate":0}
      </example_output>

      <!-- micro-example: no emoji, formal HTML list -->
      <example_input>
Dear team,

Please find below the Q1 deliverables:

• platform architecture draft<br>
• security review checklist<br>
• UI prototype link

Regards,
Dak
      </example_input>

      <example_output>
{"greetingForm":"dear team","signOffForm":"regards,","greetingPresent":1,"signOffPresent":1,"tokenTotal":39,"charTotal":233,"paragraphs":3,"bulletListPresent":1,"averageSentenceLength":11.00,"averageLinesPerParagraph":1,"averageWordLength":4.49,"typeTokenRatio":0.69,"movingAverageTtr":72,"hapaxProportion":0.49,"shannonEntropy":4.53,"lexicalDensity":0.65,"contractionRate":0,"subordinationRatio":0.14,"passiveVoiceRate":7.69,"modalVerbRate":7.69,"parseTreeDepthMean":2.8,"commasPerSentence":1.0,"exclamationPerThousandWords":0,"questionMarkRate":0,"ellipsisRate":0,"parenthesesRate":0,"emojiRate":0,"sentimentPolarity":0.1,"sentimentSubjectivity":0.3,"formalityScore":82,"hedgeRate":0,"certaintyRate":15.38,"fleschReadingEase":64,"gunningFogIndex":11,"smogIndex":10,"averageForwardReferences":0.3,"cohesionIndex":0.79,"firstPersonSingularRate":0,"firstPersonPluralRate":10.26,"secondPersonRate":0,"selfReferenceRatio":0.0,"empathyPhraseRate":0,"humorMarkerRate":0,"markupBoldRate":0,"markupItalicRate":0,"hyperlinkRate":2.56,"codeBlockRate":0,"rhetoricalQuestionRate":0,"analogyRate":0,"imperativeSentenceRate":25.64,"expletiveOpeningRate":0,"parallelismRate":1.28}
      </example_output>
    </output_format>

    <strict_guidelines>
      <rule>Any deviation from the required JSON output counts as non-compliance.</rule>
      <rule>The output must be valid JSON and include all 52 keys in the exact order specified.</rule>
    </strict_guidelines>
  </instructions>
</system_prompt>
`;
