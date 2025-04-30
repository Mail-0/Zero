import { extractStyleMatrix } from '@/lib/ai';
import { db } from '@zero/db';
import { writingStyleMatrix } from '@zero/db/schema';
import { mapToObj, pipe, entries, sortBy, take, fromEntries, sum, values, takeWhile } from 'remeda';
import { eq } from 'drizzle-orm';
import pRetry from 'p-retry';

// leaving these in here for testing between them
// (switching to `k` will surely truncate what `coverage` was keeping)
const TAKE_TOP_COVERAGE = 0.95
const TAKE_TOP_K = 10
const TAKE_TYPE: 'coverage' | 'k' = 'coverage'

// Using Welford Variance Algorithm (https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance)
// Welford’s online algorithm continuously updates the running mean and variance using just three
// numbers—sample count, current mean, and cumulative squared deviation (M₂). Therefore, each new value
// can be processed the moment it arrives, with no need to store earlier data, while maintaining high
// numerical accuracy.
const MEAN_METRIC_KEYS = [
  'avgSentenceLen',                 // average number of words in one sentence
  'avgParagraphLen',                // average number of words in one paragraph
  'listUsageRatio',                 // fraction of lines that use bullets or numbers
  'passiveVoiceRatio',              // fraction of sentences written in passive voice
  'sentimentScore',                 // overall feeling from −1 negative to 1 positive
  'politenessScore',                // how often polite words like please appear
  'confidenceScore',                // how strongly the writer sounds sure of themself
  'urgencyScore',                   // how urgent or time-sensitive the wording is
  'empathyScore',                   // how much care or concern is shown for others
  'formalityScore',                 // how formal versus casual the language is
  'hedgingRatio',                   // share of softeners like maybe or might per sentence
  'intensifierRatio',               // share of strong words like very or extremely per sentence
  'readabilityFlesch',              // flesch reading ease score higher means simpler to read (https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests)
  'lexicalDiversity',               // unique words divided by total words
  'jargonRatio',                    // fraction of technical or buzzword terms
  'exclamationFreq',                // exclamation marks per 100 words
  'slangRatio',                     // fraction of slang words like vibe or wanna
  'contractionRatio',               // fraction of words that use apostrophe contractions
  'lowercaseSentenceStartRatio',    // fraction of sentences that begin with a lowercase letter
  'emojiDensity',                   // emoji characters per 100 words in the body
  'casualPunctuationRatio',         // share of informal punctuation like "!!" or "?!"
  'capConsistencyScore',            // fraction of sentences that start with a capital letter
  'phaticPhraseRatio',              // share of small-talk phrases like "hope you are well"
] as const

const SUM_METRIC_KEYS = [
  'questionCount',                  // total question marks in the body
  'ctaCount',                       // number of direct requests for action
  'emojiCount',                     // total emoji characters in the body
  'honorificPresence',              // 1 if titles like "mr" or "dr" appear otherwise 0
  'greetingTotal',                  // total number of greetings
  'signOffTotal',                   // total number of sign offs
] as const

const TOP_COUNTS_KEYS = [
  'greeting',
  'signOff',
] as const

export const getWritingStyleMatrixForConnectionId = async (connectionId: string) => {
  return await db.query.writingStyleMatrix.findFirst({
    where: (table, ops) => {
      return ops.eq(table.connectionId, connectionId)
    },
    columns: {
      numMessages: true,
      style: true,
    },
  })
}

export const updateWritingStyleMatrix = async (connectionId: string, emailBody: string) => {
  const emailStyleMatrix = await extractStyleMatrix(emailBody)

  await pRetry(async () => {
    await db.transaction(async (tx) => {
      const [existingMatrix] = await tx
        .select({
          numMessages: writingStyleMatrix.numMessages,
          style: writingStyleMatrix.style,
        })
        .from(writingStyleMatrix)
        .where(eq(writingStyleMatrix.connectionId, connectionId))
        .for('update')

      if (!existingMatrix) {
        const newStyle = initializeStyleMatrixFromEmail(emailStyleMatrix)

        await tx.insert(writingStyleMatrix).values({
          connectionId,
          numMessages: 1,
          style: newStyle,
        })
      } else {
        const newStyle = createUpdatedMatrixFromNewEmail(existingMatrix.numMessages, existingMatrix.style, emailStyleMatrix)

        await tx.update(writingStyleMatrix).set({
          numMessages: existingMatrix.numMessages + 1,
          style: newStyle,
        }).where(eq(writingStyleMatrix.connectionId, connectionId))
      }
    })
  }, {
    retries: 1,
  })
}

const createUpdatedMatrixFromNewEmail = (numMessages: number, currentStyleMatrix: WritingStyleMatrix, emailStyleMatrix: EmailMatrix) => {
  const newStyle = {
    ...currentStyleMatrix,
  }

  for (const key of MEAN_METRIC_KEYS) {
    newStyle[key] = updateWelfordMetric(currentStyleMatrix[key], emailStyleMatrix[key])
  }

  for (const key of SUM_METRIC_KEYS) {
    newStyle[key] = currentStyleMatrix[key] + emailStyleMatrix[key]
  }

  for (const key of TOP_COUNTS_KEYS) {
    const emailValue = emailStyleMatrix[key]
    if (emailValue) {
      newStyle[key][emailValue] = (newStyle[key][emailValue] ?? 0) + 1
      newStyle[key] = TAKE_TYPE === 'coverage' ? takeTopCoverage(newStyle[key]) : takeTopK(newStyle[key])
    }
  }

  return newStyle
}

const takeTopCoverage = (data: Record<string, number>, coverage = TAKE_TOP_COVERAGE) => {
  const total = pipe(
    data,
    values(),
    sum(),
  )

  if (total === 0) {
    return {}
  }

  let running = 0

  return pipe(
    data,
    entries(),
    sortBy(([_, count]) => -count),
    takeWhile(([_, count]) => {
      running += count

      return running / total < coverage
    }),
    fromEntries(),
  )
}

const takeTopK = (data: Record<string, number>, k = TAKE_TOP_K) => {
  return pipe(
    data,
    entries(),
    sortBy(([_, count]) => -count),
    take(k),
    fromEntries(),
  )
}

const initializeStyleMatrixFromEmail = (matrix: EmailMatrix) => {
  const initializedWelfordMetrics = mapToObj(MEAN_METRIC_KEYS, (key) => {
    return [
      key,
      initializeWelfordMetric(matrix[key]),
    ]
  })

  const initializedSumMetrics = mapToObj(SUM_METRIC_KEYS, (key) => {
    return [
      key,
      matrix[key],
    ]
  })

  const initializedTopCountMetrics = mapToObj(TOP_COUNTS_KEYS, (key) => {
    return [
      key,
      matrix[key] ? { [matrix[key]]: 1 } : {},
    ]
  })

  return {
    ...initializedWelfordMetrics,
    ...initializedSumMetrics,
    ...initializedTopCountMetrics,
  }
}

const updateWelfordMetric = (previousState: WelfordState, value: number) => {
  const count = previousState.count + 1
  const delta = value - previousState.mean
  const mean = previousState.mean + delta / count
  const m2 = previousState.m2 + delta * (value - mean)

  return {
    count,
    mean,
    m2,
  }
}

const initializeWelfordMetric = (statValue: number) => {
  return {
    count: 1,
    mean: statValue,
    m2: 0,
  }
}

export type WelfordState = {
  count: number
  mean: number
  m2: number
}

export type EmailMatrix =
  & Record<typeof MEAN_METRIC_KEYS[number], number>
  & Record<typeof SUM_METRIC_KEYS[number], number>
  & Record<typeof TOP_COUNTS_KEYS[number], string | null>

export type WritingStyleMatrix =
  & Record<typeof MEAN_METRIC_KEYS[number], WelfordState>
  & Record<typeof SUM_METRIC_KEYS[number], number>
  & Record<typeof TOP_COUNTS_KEYS[number], Record<string, number>>
