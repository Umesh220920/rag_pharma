import { useState } from "react";

const suggestions = [
  "What is pharmacovigilance?",
  "How does quality control work?",
  "What records help with product traceability?",
];

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function ask(questionText) {
    const trimmedQuestion = questionText.trim();
    if (!trimmedQuestion || loading) return;

    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedQuestion },
    ]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      } else {
        data = { detail: await response.text() };
      }

      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail.trim() : "";
        const isGenericServerError =
          !detail ||
          detail === "Internal Server Error" ||
          detail.toLowerCase().includes("<html");
        throw new Error(
          isGenericServerError
            ? `The API returned an error (${response.status}). Check the API terminal for details.`
            : detail,
        );
      }
      if (typeof data?.answer !== "string" || !Array.isArray(data.sources)) {
        throw new Error("The API returned an unexpected response. Check the API terminal.");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Sorry, ${error.message}`,
          sources: [],
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    ask(question);
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pharma RAG home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>Pharma<span className="brand-light">RAG</span></span>
        </a>
        <span className="topbar-note"><span className="status-dot" /> Reference assistant</span>
      </header>

      <section className="workspace">
        <div className="intro">
          <div className="eyebrow"><span /> YOUR PHARMA KNOWLEDGE BASE</div>
          <h1>Answers, grounded<br />in your <em>data.</em></h1>
          <p>Ask a question about the reference material. Answers are generated from the most relevant records.</p>
        </div>

        <section className="chat-card" aria-label="Pharma RAG chat">
          <div className="chat-heading">
            <div className="chat-icon" aria-hidden="true">✳</div>
            <div>
              <strong>Knowledge assistant</strong>
              <span>Pharma reference · FAISS search</span>
            </div>
            <span className="online-label"><span className="status-dot" /> ONLINE</span>
          </div>

          <div className="conversation" aria-live="polite">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-symbol" aria-hidden="true">✳</div>
                <h2>What would you like to know?</h2>
                <p>Ask a question or try one of these examples.</p>
                <div className="suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      className="suggestion"
                      key={suggestion}
                      onClick={() => ask(suggestion)}
                      disabled={loading}
                    >
                      {suggestion}<span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages">
                {messages.map((message, index) => (
                  <article className={`message ${message.role}`} key={index}>
                    <span className="message-label">
                      {message.role === "user" ? "YOU" : "ASSISTANT"}
                    </span>
                    <p className={message.error ? "error-text" : ""}>{message.content}</p>
                    {message.sources?.length > 0 && (
                      <details className="sources">
                        <summary>{message.sources.length} reference sources</summary>
                        <ul>
                          {message.sources.map((source, sourceIndex) => (
                            <li key={sourceIndex}>{source}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                ))}
                {loading && (
                  <div className="message assistant loading-message">
                    <span className="message-label">ASSISTANT</span>
                    <p><span className="loader" /> Searching references and preparing an answer…</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="question">Ask a question</label>
            <input
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question about pharma data…"
              maxLength={2000}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !question.trim()} aria-label="Send question">
              <span aria-hidden="true">↑</span>
            </button>
          </form>
          <p className="disclaimer">For reference only. Not medical advice or a substitute for professional judgment.</p>
        </section>
      </section>
      <footer><span>POWERED BY FAISS + GROQ</span><span>LOCAL DEMO</span></footer>
    </main>
  );
}

export default App;
