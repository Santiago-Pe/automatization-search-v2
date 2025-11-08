export async function attempt <T>(fn: () => Promise<T>) {
	try {
		return {
			data: await fn(),
			error: null
		}
	} catch (error) {
		return {
			data: null,
			error
		}
	}
};