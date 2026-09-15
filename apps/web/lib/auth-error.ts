/** Keep transport failures distinct from rejected credentials or validation errors. */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const name = error instanceof Error ? error.name : '';
  if (name === 'AuthRetryableFetchError' || /failed to fetch|fetch failed|network request failed|networkerror|load failed/i.test(message)) {
    return '暂时无法连接账户验证服务，请检查网络或稍后重试。';
  }
  return message || '请求失败，请稍后重试';
}
