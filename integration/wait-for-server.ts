export async function isServerUp(healthUrl: string): Promise<boolean> {
  try {
    const response = await fetch(healthUrl)
    return response.ok
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error
    }
    return false
  }
}

export async function waitForServer(
  healthUrl: string,
  { timeoutMs = 20000, intervalMs = 300 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isServerUp(healthUrl)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Server did not become healthy at ${healthUrl} within ${timeoutMs}ms`)
}
