import json
import openai
from dotenv import load_dotenv
import os

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

def format_conversation(messages):
    return "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in messages])

def build_prompt(conversation_text):
    return f"""
    You are an expert evaluator of AI assistant conversations.

    Please read the following conversation between a user and an AI assistant, and assess the assistant's responses based on the following criteria:

    - Helpfulness
    - Relevance
    - Accuracy
    - Clarity

    Give the assistant an **overall score from 1 to 5**, where:
    1 = Very poor  
    2 = Poor  
    3 = Acceptable  
    4 = Good  
    5 = Excellent

    Then, provide a short explanation (1–2 sentences) justifying your score.

    Return your response in this exact format:

    Score: [1–5]  
    Explanation: <your explanation>

    Conversation:
    {conversation_text}
    """

def evaluate_conversations(input_file, output_file):
    with open(input_file, "r") as f:
        data = json.load(f)

    results = []
    total = len(data)

    for idx, conv in enumerate(data, start=1):
        conv_id = conv["conversation_id"]
        print(f"Evaluating conversation {idx}/{total} (conversation_id={conv_id})")
        conv_text = format_conversation(conv["messages"])
        prompt = build_prompt(conv_text)

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )

        evaluation = response.choices[0].message.content
        results.append({
            "conversation_id": conv_id,
            "evaluation": evaluation
        })

    with open(output_file, "w") as out:
        json.dump(results, out, indent=2)

    print(f"Saved evaluations to {output_file}")


evaluate_conversations("conversations.json", "evaluations.json")
