
import re
from nltk.tokenize import RegexpTokenizer

tokenizer = RegexpTokenizer(r"[A-Za-z]+")


def clean_text(text):
    text = str(text).lower()
    text = re.sub(r"\[.*?\]", " ", text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"<.*?>", " ", text)
    text = re.sub(r"\b\w*\d\w*\b", " ", text)

    return " ".join(tokenizer.tokenize(text))
