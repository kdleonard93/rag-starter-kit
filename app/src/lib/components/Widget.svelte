<script lang="ts">
  import posthog from 'posthog-js';

  let question = '';
  let messages: { role: 'user' | 'assistant'; text: string; citations?: any[] }[] = [];
  let loading = false;

  async function ask(event: SubmitEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    messages = [...messages, { role: 'user', text: question }];
    posthog.capture('chat_question_submitted');
    loading = true;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    messages = [...messages, { role: 'assistant', text: data.text, citations: data.citations }];
    question = '';
    loading = false;
  }
</script>

<div class="rag-widget">
  <div class="messages">
    {#each messages as m}
      <div class={m.role}>
        <p>{m.text}</p>
      </div>
    {/each}
  </div>
  <form onsubmit={ask}>
    <input bind:value={question} placeholder="Ask a question…" />
    <button type="submit" disabled={loading}>{loading ? '…' : 'Ask'}</button>
  </form>
</div>
