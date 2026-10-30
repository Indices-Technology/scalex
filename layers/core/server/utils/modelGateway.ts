/**
 * The model gateway: the ONE place ScaleX calls an LLM (ARCHITECTURE: core owns it).
 *
 * Every call logs model, prompt version, tokens and cost, and the output is parsed against a
 * zod schema before anyone sees it. A reply that doesn't parse is an error, never a guess.
 *
 * Opus 5.5 with server-side fallbacks: if the model declines, the API re-runs the request on
 * another model inside the same call, and `model` in the result says which one answered.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod/v4'
import { AppError } from '../types/errors'
import { prisma } from './db'
import { logger } from './logger'

export const DEFAULT_MODEL = 'claude-opus-5-5'

// USD per million tokens (input, output). Unknown model → cost null, never a made-up number.
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5-5': [2, 10],
}

let client: Anthropic | undefined

export type ModelBlock = Anthropic.Beta.BetaContentBlockParam

/** Who the call is for. Every call is recorded and billed against `tenant`. */
export interface CallContext {
  tenant: string
  requestId?: string
}

// Daily AI spend cap per tenant, in USD. A runaway loop or a flood of uploads stops here.
const dailyCapMicros = () => Math.round((Number(process.env.SCALEX_DAILY_AI_USD) || 5) * 1e6)

export interface ModelCall<S extends z.ZodType> {
  ctx: CallContext
  /** What is asking, e.g. 'listing-proposal'. Goes in every log line. */
  task: string
  /** Bump when the prompt changes, so results can be compared across versions. */
  promptVersion: string
  system: string
  content: ModelBlock[]
  schema: S
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

export interface ModelResult<T> {
  /** The ModelCall row, so whatever the call produced can point back at it. */
  callId: string
  output: T
  model: string
  promptVersion: string
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

export async function callModel<S extends z.ZodType>(call: ModelCall<S>): Promise<ModelResult<z.infer<S>>> {
  const { tenant, requestId } = call.ctx
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const spent = await prisma.modelCall.aggregate({
    where: { tenant, createdAt: { gte: since } },
    _sum: { costMicros: true },
  })
  if ((spent._sum.costMicros ?? 0) >= dailyCapMicros()) {
    logger.warn('[modelGateway] daily cap reached', { tenant, task: call.task, requestId })
    throw new AppError('AI_CAP_REACHED', 'Daily AI budget used up. Try again tomorrow.', 429)
  }

  client ??= new Anthropic()
  const started = Date.now()
  const base = { tenant, task: call.task, promptVersion: call.promptVersion, requestId }

  let res
  try {
    res = await client.beta.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: call.effort ?? 'medium', format: betaZodOutputFormat(call.schema) },
      system: call.system,
      messages: [{ role: 'user', content: call.content }],
    })
  } catch (err) {
    // Failed calls are recorded too: a provider outage must show up in the numbers.
    await prisma.modelCall.create({
      data: { ...base, model: DEFAULT_MODEL, ms: Date.now() - started, ok: false, error: String((err as Error).message).slice(0, 500) },
    })
    throw err
  }

  const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0)
  const outputTokens = res.usage.output_tokens
  const price = PRICES[res.model]
  const costMicros = price ? Math.round(inputTokens * price[0] + outputTokens * price[1]) : null
  const ok = res.stop_reason !== 'refusal' && res.parsed_output != null
  const row = await prisma.modelCall.create({
    data: {
      ...base,
      model: res.model,
      inputTokens,
      outputTokens,
      costMicros,
      ms: Date.now() - started,
      stopReason: res.stop_reason,
      ok,
      error: ok ? null : 'no usable output',
    },
  })
  const meta = { ...base, callId: row.id, model: res.model, stopReason: res.stop_reason, inputTokens, outputTokens, costMicros, ms: row.ms }

  if (!ok) {
    logger.warn('[modelGateway] no usable output', meta)
    throw new Error(`model gave no usable output (stop_reason=${res.stop_reason})`)
  }
  logger.info('[modelGateway] ok', meta)

  return {
    callId: row.id,
    output: res.parsed_output!,
    model: res.model,
    promptVersion: call.promptVersion,
    inputTokens,
    outputTokens,
    costUsd: costMicros == null ? null : costMicros / 1e6,
  }
}
