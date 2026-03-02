"""
Chatbot memory example for NeuralMemory.

This example demonstrates how to use NeuralMemory
to give a chatbot persistent memory across conversations.
"""

import asyncio
from datetime import datetime
from typing import Any

from neural_memory.core.brain import Brain, BrainConfig
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.engine.retrieval import DepthLevel, ReflexPipeline
from neural_memory.storage.memory_store import InMemoryStorage


class MemoryBot:
    """A simple chatbot with neural memory."""

    def __init__(self) -> None:
        self.storage: InMemoryStorage | None = None
        self.brain: Brain | None = None
        self.encoder: MemoryEncoder | None = None
        self.pipeline: ReflexPipeline | None = None

    async def initialize(self, brain_name: str = "chatbot_brain") -> None:
        """Initialize the bot's memory system."""
        self.storage = InMemoryStorage()

        config = BrainConfig(
            decay_rate=0.1,
            activation_threshold=0.15,
            max_spread_hops=4,
            max_context_tokens=800,
        )

        self.brain = Brain.create(name=brain_name, config=config)
        await self.storage.save_brain(self.brain)
        self.storage.set_brain(self.brain.id)

        self.encoder = MemoryEncoder(self.storage, config)
        self.pipeline = ReflexPipeline(self.storage, config)

        print(f"Initialized memory system: {brain_name}")

    async def remember(self, content: str, metadata: dict[str, Any] | None = None) -> str:
        """Store a new memory."""
        if self.encoder is None:
            raise RuntimeError("Bot not initialized")

        result = await self.encoder.encode(
            content,
            timestamp=datetime.now(),
            metadata=metadata,
        )

        return result.fiber.id

    async def recall(self, query: str, depth: DepthLevel = DepthLevel.CONTEXT) -> str:
        """Recall relevant memories for a query."""
        if self.pipeline is None:
            raise RuntimeError("Bot not initialized")

        result = await self.pipeline.query(
            query,
            depth=depth,
            max_tokens=500,
        )

        return result.context

    async def get_answer(self, query: str) -> tuple[str | None, float]:
        """Get a direct answer to a query if possible."""
        if self.pipeline is None:
            raise RuntimeError("Bot not initialized")

        result = await self.pipeline.query(query)
        return result.answer, result.confidence


async def simulate_conversation() -> None:
    """Simulate a conversation with memory."""
    bot = MemoryBot()
    await bot.initialize("assistant_memory")

    # Session 1: User tells the bot about themselves
    print("\n=== Session 1: Learning about the user ===")

    user_info = [
        "My name is John and I work as a software engineer",
        "I prefer Python over JavaScript for backend development",
        "My favorite cafe is Blue Bottle on Main Street",
        "I'm working on a machine learning project for image recognition",
    ]

    for info in user_info:
        print(f"User: {info}")
        await bot.remember(info, metadata={"type": "user_info"})
        print("Bot: Got it, I'll remember that!\n")

    # Session 2: User asks questions (simulating new session)
    print("\n=== Session 2: Recalling information ===")

    questions = [
        "What's my name?",
        "What do I do for work?",
        "Where do I like to get coffee?",
        "What project am I working on?",
        "Do I prefer Python or JavaScript?",
    ]

    for question in questions:
        print(f"User: {question}")
        answer, confidence = await bot.get_answer(question)
        if answer and confidence > 0.3:
            print(f"Bot: Based on what I remember: {answer}")
            print(f"     (Confidence: {confidence:.2f})\n")
        else:
            context = await bot.recall(question)
            print(f"Bot: Let me check... Here's what I found:")
            print(f"     {context[:200]}...\n")

    # Session 3: Adding new memories and recalling context
    print("\n=== Session 3: Building on memories ===")

    await bot.remember("Today I had a breakthrough with the image recognition model")
    await bot.remember("The model achieved 95% accuracy on the test set")

    print("User: Tell me about my recent progress")
    context = await bot.recall("recent progress on the project")
    print(f"Bot: Here's what I know about your recent work:")
    print(f"     {context}\n")


async def main() -> None:
    print("=" * 60)
    print("NeuralMemory Chatbot Demo")
    print("=" * 60)

    await simulate_conversation()

    print("\n" + "=" * 60)
    print("Demo complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
