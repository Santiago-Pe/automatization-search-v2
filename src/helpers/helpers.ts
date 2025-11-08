export async function attempt<T>(fn: () => Promise<T>) {
  try {
    return {
      data: await fn(),
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

export async function retry<T>(
  fn: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 500
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay * 2); // backoff exponencial
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}

export async function processInBatches<T>(
  tasks: (() => Promise<T>)[], 
  batchSize: number = 2
): Promise<void> {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map(task => task()));
  }
}