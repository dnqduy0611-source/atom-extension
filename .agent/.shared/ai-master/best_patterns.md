### 🤖 AI Engineering Master Patterns

#### 1. Zero-Shot Planning Prompt
`Role: Senior Architect. Task: Analyze the following request and output a 3-phase implementation plan emphasizing data integrity and UI aesthetics.`

#### 2. RAG (Retrieval Augmented Generation) Strategy
- **Chunking**: Overlapping fixed-size (500 tokens) with Markdown headers preservation.
- **Embedding**: Use `text-embedding-3-large` for high semantic density.
- **Retrieval**: Hybrid search (Dense + BM25) for precision.

#### 3. Structured Output Mode
- Always enforce JSON schema for agent-to-agent communication.
- Use Zod schemas for validation after every LLM generation.
