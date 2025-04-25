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

const METRIC_KEYS = [
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
  'emojiCount',                     // total emoji characters in the body
  'questionCount',                  // total question marks in the body
  'ctaCount',                       // number of direct requests for action
  'slangRatio',                     // fraction of slang words like vibe or wanna
  'contractionRatio',               // fraction of words that use apostrophe contractions
  'lowercaseSentenceStartRatio',    // fraction of sentences that begin with a lowercase letter
  'subjectEmojiCount',              // emoji characters found in the subject line
  'subjectInformalityScore',        // overall casualness score for the subject line
  'emojiDensity',                   // emoji characters per 100 words in the body
  'casualPunctuationRatio',         // share of informal punctuation like "!!" or "?!"
  'capConsistencyScore',            // fraction of sentences that start with a capital letter
  'honorificPresence',              // 1 if titles like "mr" or "dr" appear otherwise 0
  'phaticPhraseRatio',              // share of small-talk phrases like "hope you are well"
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

  // Update each metric
  for (const key of METRIC_KEYS) {
    newStyle.metrics[key] = updateStat(currentStyleMatrix.metrics[key], emailStyleMatrix[key], newNumMessages)
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
    newStyle.pGreet = newStyle.greetingTotal / newNumMessages
  }

  if (signOff) {
    const currentSignOffCount = newStyle.signOffCounts[signOff] ?? 0

    // Increment the specific sign off
    newStyle.signOffCounts[signOff] = currentSignOffCount + 1
    newStyle.signOffCounts = TAKE_TYPE === 'coverage' ? takeTopCoverage(newStyle.signOffCounts) : takeTopK(newStyle.signOffCounts)

    // Record the total number of sign offs
    newStyle.signOffTotal = newStyle.signOffTotal + 1
    newStyle.pSign = newStyle.signOffTotal / newNumMessages
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

const updateStat = (currentStat: RunningStat, value: number, newTotalEmails: number) => {
  const delta = value - currentStat.mean
  const mean = currentStat.mean + delta / newTotalEmails
  const m2 = currentStat.m2 + delta * (value - mean)

  return {
    mean,
    m2,
  }
}

const initializeStyleMatrixFromEmail = (matrix: EmailMatrix): WritingStyleMatrix => {
  const initializedMetrics = mapToObj(METRIC_KEYS, (key) => {
    return [
      key,
      initializeRunningState(matrix[key]),
    ]
  })

  const greetingTotal = matrix.greeting ? 1 : 0
  const signOffTotal = matrix.signOff ? 1 : 0

  return {
    greetingCounts: matrix.greeting ? {
      [matrix.greeting]: 1,
    } : {},
    greetingTotal,
    signOffCounts: matrix.signOff ? {
      [matrix.signOff]: 1,
    }: {},
    signOffTotal,
    pGreet: greetingTotal, // these initialize the same
    pSign: signOffTotal, // these initialize the same
    metrics: initializedMetrics,
  }
}

const initializeRunningState = (statValue: number) => {
  return {
    mean: statValue,
    m2: 0,
  }
}

export type RunningStat = {
  mean: number
  m2: number
}

export type EmailMetrics = Record<typeof METRIC_KEYS[number], number>
export type EmailMatrix = {
  greeting: string | null
  signOff: string | null
} & EmailMetrics

export type StyleMetrics = Record<typeof METRIC_KEYS[number], RunningStat>
export type WritingStyleMatrix = {
  greetingCounts: Record<string, number>
  greetingTotal: number
  pGreet: number
  signOffCounts: Record<string, number>
  signOffTotal: number
  pSign: number
  metrics: StyleMetrics
}
