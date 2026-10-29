// D1 sometimes resets the database while an import runs (`D1_RESET_DO`) or drops the connection. Both are safe to
// retry because a failed import rolls back; any other error is a real problem and must not be retried.
export const isTransientD1Error = (message: string): boolean => /D1_RESET_DO|Network connection lost|D1 DB is overloaded|temporarily unavailable/i.test(message)

type RetryOptions = { delays?: number[]; sleep?: (ms: number) => Promise<void> }

export async function runWithRetry<T>(run: () => T | Promise<T>, { delays = [5_000, 15_000], sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: RetryOptions = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (attempt >= delays.length || !isTransientD1Error(message)) throw error
      console.warn(`Transient D1 failure (attempt ${attempt + 1}); retrying in ${delays[attempt] / 1000}s ...`)
      await sleep(delays[attempt])
    }
  }
}
