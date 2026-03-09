import { Notification } from '@jupyterlab/apputils';

// エラーから表示用メッセージを生成する関数
function formatErrorMessage(error: any): string {
  let type: string;
  let message: string;
  let filename = 'unknown';
  let lineNumber = -1;

  if (error instanceof ErrorEvent) {
    type = 'Uncaught exception';
    message = error.message || 'Unknown error';
    filename = error.filename || 'unknown';
    lineNumber = error.lineno || -1;
  } else if (error instanceof PromiseRejectionEvent) {
    // PromiseRejectionEventの場合
    const promiseError = (error as any).reason || {};
    type = 'Uncaught promise rejection';
    message = promiseError.message || 'Unknown error';
    filename = promiseError.filename || 'unknown';
    lineNumber = promiseError.lineno || -1;
  } else if (error instanceof Error) {
    type = 'Error';
    message = error.message || 'Unknown error';
  } else {
    type = 'Unknown error';
    message = String(error);
  }

  // エラー名が含まれていない場合は追加（ただし、typeと一致する場合は除く）
  if (
    error.name &&
    error.name !== type &&
    message !== error.name &&
    !message.startsWith(`${error.name}:`)
  ) {
    message = `${error.name}: ${message}`;
  }

  const locationInfo =
    filename !== 'unknown' ? ` at ${filename}:${lineNumber}` : '';
  return `${type}: ${message}${locationInfo}`;
}

// エラーハンドリング付きのコールバック関数を作成
export function errorHandler<T extends (...args: any[]) => any>(
  callback: T
): T {
  return ((...args: any[]) => {
    try {
      const result = callback(...args);

      // Promiseの場合は非同期エラーもキャッチ
      if (result instanceof Promise) {
        return result.catch(error => {
          const errorMessage = formatErrorMessage(error);
          console.error(errorMessage, error);

          Notification.error(errorMessage, {
            autoClose: false
          });
        });
      }

      return result;
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      console.error(errorMessage, error);

      Notification.error(errorMessage, {
        autoClose: false
      });
    }
  }) as T;
}
