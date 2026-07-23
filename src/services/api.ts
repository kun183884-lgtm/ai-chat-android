import { Message } from '../utils/storage';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export function streamChat(
  messages: Message[],
  apiKey: string,
  apiUrl: string,
  model: string,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController();

  const body = JSON.stringify({
    model,
    messages: messages.map(({ role, content }) => ({ role, content })),
    stream: true,
  });

  const xhr = new XMLHttpRequest();
  let lastIndex = 0;

  xhr.open('POST', `${apiUrl.replace(/\/+$/, '')}/chat/completions`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 3 || xhr.readyState === 4) {
      const newData = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;

      const lines = newData.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          callbacks.onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) callbacks.onToken(content);
        } catch {}
      }

      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          callbacks.onDone();
        } else {
          let errMsg = `HTTP ${xhr.status}`;
          try {
            const err = JSON.parse(xhr.responseText);
            errMsg = err.error?.message || errMsg;
          } catch {}
          callbacks.onError(new Error(errMsg));
        }
      }
    }
  };

  xhr.onerror = () => callbacks.onError(new Error('Network request failed'));
  xhr.send(body);

  controller.signal.addEventListener('abort', () => xhr.abort());
  return controller;
}
