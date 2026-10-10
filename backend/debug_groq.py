import os
from dotenv import load_dotenv

load_dotenv()

from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])
resp = client.chat.completions.create(
    model=os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"),
    messages=[{"role": "user", "content": "Say hello briefly."}],
    max_tokens=20,
)
print(resp.choices[0].message.content)
