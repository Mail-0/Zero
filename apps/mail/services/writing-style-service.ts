import { extractStyleMatrix } from '@/lib/ai';
import { db } from '@zero/db';
import { writingStyleMatrix } from '@zero/db/schema';
import { mapToObj, pipe, entries, sortBy, take, fromEntries, sum, values, takeWhile } from 'remeda';
import { eq } from 'drizzle-orm';

const TAKE_TOP_COVERAGE = 0.95
const TAKE_TOP_K = 10
const TAKE_TYPE: 'coverage' | 'k' = 'coverage'

const METRIC_KEYS = [
  'avgSentenceLen',
  'avgParagraphLen',
  'listUsageRatio',
  'passiveVoiceRatio',
  'sentimentScore',
  'politenessScore',
  'confidenceScore',
  'urgencyScore',
  'empathyScore',
  'formalityScore',
  'hedgingRatio',
  'intensifierRatio',
  'readabilityFlesch',
  'lexicalDiversity',
  'jargonRatio',
  'exclamationFreq',
  'emojiCount',
  'questionCount',
  'ctaCount',
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
    signatureHash,
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
    newStyle.signOffCounts[signOff] = currentSignOffCount + 1
    newStyle.signOffCounts = TAKE_TYPE === 'coverage' ? takeTopCoverage(newStyle.signOffCounts) : takeTopK(newStyle.signOffCounts)

    // Record the total number of sign offs
    newStyle.signOffTotal = newStyle.signOffTotal + 1
  }

  if (signatureHash) {
    const currentSignatureHashCount = newStyle.signatureHashCounts[signatureHash] ?? 0
    newStyle.signatureHashCounts[signatureHash] = currentSignatureHashCount + 1
    newStyle.signatureHashCounts = TAKE_TYPE === 'coverage' ? takeTopCoverage(newStyle.signatureHashCounts) : takeTopK(newStyle.signatureHashCounts)

    // Record the total number of signature hashes
    newStyle.signatureHashTotal = newStyle.signatureHashTotal + 1
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

  return {
    greetingCounts: matrix.greeting ? {
      [matrix.greeting]: 1,
    } : {},
    greetingTotal: 1,
    signOffCounts: matrix.signOff ? {
      [matrix.signOff]: 1,
    }: {},
    signOffTotal: 1,
    signatureHashCounts: matrix.signatureHash ? {
      [matrix.signatureHash]: 1,
    }: {},
    signatureHashTotal: 1,
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
  signatureHash: string | null
} & EmailMetrics

export type StyleMetrics = Record<typeof METRIC_KEYS[number], RunningStat>
export type WritingStyleMatrix = {
  greetingCounts: Record<string, number>
  greetingTotal: number
  signOffCounts: Record<string, number>
  signOffTotal: number
  signatureHashCounts: Record<string, number>
  signatureHashTotal: number
  metrics: StyleMetrics
}
