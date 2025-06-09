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
    - Whether it actually answered the question with the given information.

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
        raw = json.load(f)

    # Support grouped conversations ({systemPrompt, conversations}[]) or flat list [{conversation_id, messages}]
    convs = []
    if isinstance(raw, list) and raw and isinstance(raw[0], dict) and "systemPrompt" in raw[0] and "conversations" in raw[0]:
        for group in raw:
            sp = group.get("systemPrompt")
            for conv in group.get("conversations", []):
                entry = conv.copy()
                entry["systemPrompt"] = sp
                convs.append(entry)
    else:
        convs = raw

    results = []
    total = len(convs)

    for idx, conv in enumerate(convs, start=1):
        conv_id = conv.get("conversation_id")
        sp = conv.get("systemPrompt")
        print(f"Evaluating conversation {idx}/{total} (conversation_id={conv_id})")
        # format only user–assistant messages; systemPrompt is metadata
        conv_text = format_conversation(conv.get("messages", []))
        prompt = build_prompt(conv_text)

        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )

        evaluation = response.choices[0].message.content
        rec = {"conversation_id": conv_id, "evaluation": evaluation}
        if sp is not None:
            rec["systemPrompt"] = sp
        results.append(rec)

    with open(output_file, "w") as out:
        json.dump(results, out, indent=2)

    print(f"Saved evaluations to {output_file}")


evaluate_conversations("conversations.json", "evaluations.json")
