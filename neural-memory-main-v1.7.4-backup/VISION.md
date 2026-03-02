# NeuralMemory — Vision & North Star

> NeuralMemory không tìm memory — nó **kích hoạt** memory.
> Recall Through Activation, Not Search.

---

## The Key: Associative Reflex (Phản xạ Liên tưởng)

NeuralMemory không phải database. Không phải vector store. Không phải RAG pipeline.

NeuralMemory là **bộ nhớ sinh học cho AI** — nó sống, nó quên, nó liên tưởng,
và nó là chuẩn mở cho mọi AI tool chia sẻ ký ức.

Khi bạn hỏi một câu, NeuralMemory không "tìm kiếm" — nó **kích hoạt lan truyền**
qua mạng neuron, giống cách bộ não thật phản xạ. Ký ức liên quan tự nổi lên,
không cần keyword match, không cần cosine similarity.

---

## 3 Trụ Cột Cốt Lõi

### 1. Recall Through Activation (Kích hoạt, không tìm kiếm)

```
Query → Spreading Activation → Related memories surface naturally
```

- Không phải keyword search, không phải vector similarity
- Là **lan truyền kích hoạt** qua graph — hỏi "API format" thì nhớ luôn
  "authentication decision" vì chúng liên kết qua synapse
- Depth levels (instant → context → habit → deep) giống cách não nhớ nhanh vs nhớ sâu
- Query càng chi tiết (thêm keyword, time) → recall càng nhanh, dùng ít context hơn
- Đây là lợi thế lớn nhất của associative vs search

**Nếu bỏ hết vector embeddings và semantic search, hệ thống vẫn phải recall được.**
Nếu không → đã lệch khỏi key cốt lõi.

### 2. Temporal & Causal Topology (Cấu trúc Thời gian & Nhân quả)

```
"Vì chuyện A xảy ra chiều qua, nên sáng nay tôi mới làm chuyện B"
```

- Ký ức không phẳng (flat) — mọi ký ức KHÔNG có giá trị ngang nhau
- Ký ức phải có **chiều sâu thời gian** và **logic nguyên nhân - kết quả**
- Hệ thống phải trả lời được "**Tại sao?**" và "**Khi nào?**" một cách tự nhiên
  nhờ duyệt các sợi thần kinh thời gian, không chỉ "Cái gì?" như RAG
- Não nhớ theo chuỗi: sự kiện → nguyên nhân → hệ quả → quyết định

### 3. Portable Consciousness (Tính Di động của Ý thức)

```
Brain chuyên gia Crypto → lắp vào Agent A (hỗ trợ khách hàng)
                        → lắp vào Agent B (trading bot)
Toàn bộ phản xạ và liên tưởng được chuyển giao nguyên vẹn.
```

- Bộ nhớ KHÔNG dính chặt vào một Agent duy nhất
- "Bộ não" là module có thể tháo lắp — **Brain-as-a-Service**
- Export/Import/Merge giữ nguyên toàn bộ cấu trúc graph
- Tập trung vào Packaging và Standardization để "Swap não" mượt mà
- MCP protocol → bất kỳ AI agent nào cũng plug-in được

---

## Công Thức Kiểm Tra Mỗi Khi Update

Trước khi thêm feature, refactor, hoặc mở rộng, **tự hỏi 4 câu này**:

### Câu 1: Activation hay Search?

> Feature này giúp recall giống **phản xạ** hơn hay chỉ giúp **search** tốt hơn?

Nếu chỉ giúp search → **lệch hướng**.

### Câu 2: Spreading Activation vẫn là trung tâm?

> Tính năng này có còn giữ nguyên cơ chế "kích hoạt lan truyền" là trung tâm không?

Nếu "không, giờ chủ yếu search rồi" → **lệch hướng**.

### Câu 3: Bỏ embeddings vẫn chạy?

> Nếu bỏ hết vector embeddings và semantic search, hệ thống vẫn recall được không?

Nếu "không" → **lệch khỏi key cốt lõi**.

### Câu 4: Query chi tiết hơn = nhanh hơn?

> Khi query chi tiết hơn (thêm keyword/time), recall có nhanh hơn & dùng ít context hơn không?

Đây là lợi thế lớn nhất của associative vs search. Nếu mất lợi thế này → **lệch hướng**.

---

## Brain Test

Ngoài 4 câu trên, luôn hỏi thêm:

> **"Bộ não thật có làm điều này không?"**

| Feature idea | Brain test | Verdict |
|---|---|---|
| Memory decay over time | Não quên dần | Yes |
| Consolidation (prune/merge) | Não gom ký ức khi ngủ | Yes |
| Spreading activation | Liên tưởng tự nhiên | Yes |
| Typed memories (fact, decision, todo) | Não phân loại ký ức | Yes |
| Conflict resolution on merge | Hai nguồn mâu thuẫn → não chọn | Yes |
| Temporal & causal links | "Vì A nên B" | Yes |
| Emotional valence | Ký ức gắn cảm xúc | Yes |
| Full-text search engine | Não không grep | **No** |
| Vector similarity ranking | Não không tính cosine | **Careful** |
| AI-generated summaries | Não tự tóm tắt | Yes |

---

## Memory Lifecycle (Vòng đời ký ức)

```
Create → Reinforce → Decay → Consolidate → Forget
  ↑                                           |
  └───────── Re-activate ─────────────────────┘
```

- **Create**: Ký ức mới tạo ra yếu
- **Reinforce**: Được nhắc lại → mạnh lên (Hebbian learning)
- **Decay**: Không dùng → phai dần
- **Consolidate**: "Ngủ" → gom lại, tỉa bớt, tạo schema
- **Forget**: Hết hạn hoặc quá yếu → bị xóa
- **Re-activate**: Ký ức cũ được kích hoạt lại → quay về Reinforce

Đây là thứ mà Redis, Pinecone, ChromaDB **không có**.

---

## Roadmap Định Hướng Theo Vision

> **Chi tiết đầy đủ xem [ROADMAP.md](ROADMAP.md)** — versioned roadmap v0.14.0 → v1.0.0
> với gap coverage matrix, expert feedback mapping, và VISION.md checklist per phase.

### Đã có (v0.13.0)

- [x] Spreading activation retrieval (4 depth levels)
- [x] Hebbian learning (reinforcement through use)
- [x] Memory decay over time (type-aware)
- [x] Sleep & Consolidate (prune/merge/summarize/mature)
- [x] Typed memories with priorities and expiry
- [x] Brain export/import/merge (portable consciousness)
- [x] Conflict resolution (4 strategies)
- [x] MCP protocol (standard memory layer)
- [x] VS Code extension
- [x] REST API + WebSocket sync
- [x] Cognitive runtime (firing threshold, refractory period, homeostasis)
- [x] SimHash deduplication
- [x] Score breakdown (activation, freshness, frequency, intersection)
- [x] Auto-tags (entity + keyword extraction)

### Hướng phát triển tiếp theo

| Version | Theme | Key Deliverable |
|---------|-------|-----------------|
| v0.14.0 | Relation Extraction | Auto-synapses from content + tag origin tracking |
| v0.15.0 | Associative Inference | Co-activation → persistent synapses + tag normalization |
| v0.16.0 | Emotional Valence | Sentiment at encode time, emotion synapses |
| v0.17.0 | Brain Diagnostics | Purity score, health report, `nmem health` |
| v0.18.0 | Advanced Consolidation | ENRICH + DREAM strategies |
| v0.19.0 | Temporal Reasoning | Causal chain queries, "Why?" and "When?" |
| v1.0.0 | Portable Consciousness v2 | Brain versioning, partial transplant, marketplace |

See [ROADMAP.md](ROADMAP.md) for full details, dependency graph, and coverage matrices.

---

## What NeuralMemory Is NOT

| NeuralMemory is NOT | It IS |
|---|---|
| A database | A living memory system |
| A vector store | An associative reflex engine |
| A search engine | An activation network |
| A RAG pipeline | A biological memory model |
| A cache | A consciousness module |
| Flat storage | Temporal-causal topology |
| Vendor-locked | A portable open standard |

---

## One-Line North Star

> **NeuralMemory: Bộ nhớ sinh học cho AI — kích hoạt thay vì tìm kiếm,
> liên tưởng thay vì truy vấn, di động thay vì gắn chặt.**

---

*Last updated: 2026-02-08*
