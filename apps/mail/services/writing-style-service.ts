import { extractStyleMatrix } from '@/lib/ai';
import { db } from '@zero/db';
import { writingStyleMatrix } from '@zero/db/schema';
import { mapToObj, pipe, entries, sortBy, take, fromEntries, sum, values, takeWhile } from 'remeda';
import { eq } from 'drizzle-orm';

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
  'signoff',
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

  await db.transaction(async (tx) => {
    const existingMatrix = await tx.query.writingStyleMatrix.findFirst({
      where: (table, ops) => {
        return ops.eq(table.connectionId, connectionId)
      },
      columns: {
        numMessages: true,
        style: true,
      }
    })

    if (!existingMatrix) {
      // First email
      const newStyleMatrix = initializeStyleMatrixFromEmail(emailStyleMatrix)

      await tx.insert(writingStyleMatrix).values({
        connectionId,
        numMessages: 1,
        style: newStyleMatrix,
      })
    } else {
      const newStyleMatrix = createUpdatedMatrixFromNewEmail(existingMatrix.numMessages, existingMatrix.style, emailStyleMatrix)

      await tx.update(writingStyleMatrix).set({
        numMessages: existingMatrix.numMessages + 1,
        style: newStyleMatrix,
      }).where(eq(writingStyleMatrix.connectionId, connectionId))
    }
  })
}

const createUpdatedMatrixFromNewEmail = (numMessages: number, currentStyleMatrix: WritingStyleMatrix, emailStyleMatrix: EmailMatrix) => {
  const newNumMessages = numMessages + 1
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

  }

  // We already did sanitization in the extractStyleMatrix()
  const {
    greeting,
    signOff,
  } = emailStyleMatrix

  if (greeting) {
    const currentGreetingCount = newStyle.greetingCounts[greeting] ?? 0

    // Increment the specific greeting
    newStyle.greetingCounts[greeting] = currentGreetingCount + 1
    newStyle.greetingCounts = TAKE_TYPE === 'coverage' ? takeTopCoverage(newStyle.greetingCounts) : takeTopK(newStyle.greetingCounts)

    // Record the total number of greetings
    newStyle.greetingTotal = newStyle.greetingTotal + 1
  }

  if (signOff) {
    const currentSignOffCount = newStyle.signOffCounts[signOff] ?? 0

    // Increment the specific sign off
    newStyle.signOffCounts[signOff] = currentSignOffCount + 1
    newStyle.signOffCounts = TAKE_TYPE === 'coverage' ? takeTopCoverage(newStyle.signOffCounts) : takeTopK(newStyle.signOffCounts)

    // Record the total number of sign offs
    newStyle.signOffTotal = newStyle.signOffTotal + 1
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

const updateStat = (currentStat: WelfordState, value: number, newTotalEmails: number) => {
  const delta = value - currentStat.mean
  const mean = currentStat.mean + delta / newTotalEmails
  const m2 = currentStat.m2 + delta * (value - mean)

  return {
    mean,
    m2,
  }
}

const initializeStyleMatrixFromEmail = (matrix: EmailMatrix): WritingStyleMatrix => {
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

  return {
    ...initializedWelfordMetrics,
    ...initializedSumMetrics,
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

export type EmailMetrics = Record<typeof MEAN_METRIC_KEYS[number], number>
  & Record<typeof SUM_METRIC_KEYS[number], number>

export type EmailMatrix = {
  greeting: string | null
  signOff: string | null
} & EmailMetrics

export type WritingStyleMatrix = Record<typeof MEAN_METRIC_KEYS[number], WelfordState>
  & Record<typeof SUM_METRIC_KEYS[number], number>
  & Record<typeof TOP_COUNTS_KEYS[number], Record<string, number>>
