
from pathlib import Path
from io import BytesIO

import joblib
import numpy as np

from flask import Flask, jsonify, request
from flask_cors import CORS
from pypdf import PdfReader
from docx import Document

app = Flask(__name__)
CORS(app)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "newsguard_model.pkl"

MAX_ARTICLE_LENGTH = 20000
CONFIDENCE_THRESHOLD = 70.0

# Load the existing website model
if not MODEL_PATH.exists():
    raise FileNotFoundError(
        "newsguard_model.pkl was not found in the backend folder."
    )

model = joblib.load(MODEL_PATH)

# Validate model pipeline
if not hasattr(model, "named_steps"):
    raise ValueError("Invalid model pipeline.")

if "tfidf" not in model.named_steps:
    raise ValueError("TF-IDF step missing.")

if "classifier" not in model.named_steps:
    raise ValueError("Classifier step missing.")

if set(str(label) for label in model.classes_) != {"Fake", "Real"}:
    raise ValueError("Model must contain Fake and Real labels.")

# Get the word-level vectorizer from the trained pipeline.
# We use word features for readable explanations.
tfidf_features = model.named_steps["tfidf"]

word_vectorizer = dict(
    tfidf_features.transformer_list
)["word"]

classifier = model.named_steps["classifier"]

word_feature_count = len(
    word_vectorizer.get_feature_names_out()
)

# The first section of the classifier coefficients
# corresponds to word-level TF-IDF features.
word_coefficients = classifier.coef_[0][:word_feature_count]

feature_names = word_vectorizer.get_feature_names_out()

print("NewsGuard AI model loaded successfully!")


# Explain which word features influenced the prediction
def explain_prediction(article, prediction, limit=5):

    try:
        article_features = word_vectorizer.transform([article])

        if article_features.nnz == 0:
            return []

        contributions = article_features.multiply(
            word_coefficients
        ).tocsr()

        values = contributions.data
        indices = contributions.indices

        if prediction == "Real":
            selected = [
                (index, value)
                for index, value in zip(indices, values)
                if value > 0
            ]
            selected.sort(key=lambda item: item[1], reverse=True)
            influence = "supports_real"

        else:
            selected = [
                (index, value)
                for index, value in zip(indices, values)
                if value < 0
            ]
            selected.sort(key=lambda item: item[1])

            selected = [
                (index, abs(value))
                for index, value in selected
            ]

            influence = "supports_fake"

        explanations = []

        for index, score in selected[:limit]:

            explanations.append({
                "term": str(feature_names[index]),
                "influence": influence
            })

        return explanations

    except Exception as error:
        print("Explanation error:", error)
        return []


# Health check
@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "status": "success",
        "message": "NewsGuard AI API is running",
        "model_loaded": True
    })


# News prediction
@app.route("/api/predict", methods=["POST"])
def predict():

    try:
        data = request.get_json(silent=True) or {}
        article = data.get("article", "")

        if not isinstance(article, str):
            return jsonify({
                "error": "Article must be text."
            }), 400

        article = article.strip()

        if not article:
            return jsonify({
                "error": "Please enter an article."
            }), 400

        if len(article) > MAX_ARTICLE_LENGTH:
            return jsonify({
                "error": "Article must not exceed 20,000 characters."
            }), 400

        # Get model probabilities
        probabilities = model.predict_proba([article])[0]

        class_probabilities = {
            str(label): round(float(probability) * 100, 2)
            for label, probability in zip(
                model.classes_,
                probabilities
            )
        }

        raw_prediction = max(
            class_probabilities,
            key=class_probabilities.get
        )

        confidence = class_probabilities[raw_prediction]

        if confidence < CONFIDENCE_THRESHOLD:
            prediction = "Uncertain"
        else:
            prediction = raw_prediction

        # Generate word-level explanation
        explanations = explain_prediction(
            article,
            raw_prediction
        )

        return jsonify({
            "prediction": prediction,
            "model_prediction": raw_prediction,
            "confidence": confidence,
            "probabilities": class_probabilities,
            "uncertain": confidence < CONFIDENCE_THRESHOLD,
            "explanations": explanations,
            "explanation_note": (
                "These words and phrases are statistical patterns "
                "that influenced the model. They are not evidence "
                "that the article is true or false."
            ),
            "note": (
                "This is a machine-learning prediction based on "
                "patterns learned from the training dataset. "
                "It is not an independent fact-check. "
                "Verify important information using reliable sources."
            )
        })

    except Exception as error:
        print("Prediction error:", error)

        return jsonify({
            "error": "Unable to analyze the article."
        }), 500


# Document upload: TXT, PDF and DOCX
@app.route("/api/upload", methods=["POST"])
def upload():

    try:
        if "file" not in request.files:
            return jsonify({
                "error": "No file selected."
            }), 400

        file = request.files["file"]

        if not file.filename:
            return jsonify({
                "error": "Please select a file."
            }), 400

        extension = Path(file.filename).suffix.lower()

        if extension == ".txt":

            extracted_text = file.read().decode(
                "utf-8",
                errors="ignore"
            )

        elif extension == ".pdf":

            pdf = PdfReader(BytesIO(file.read()))

            extracted_text = "\n".join(
                page.extract_text() or ""
                for page in pdf.pages
            )

        elif extension == ".docx":

            document = Document(BytesIO(file.read()))

            extracted_text = "\n".join(
                paragraph.text
                for paragraph in document.paragraphs
            )

        else:
            return jsonify({
                "error": "Only TXT, PDF and DOCX files are supported."
            }), 400

        extracted_text = extracted_text.strip()

        if not extracted_text:
            return jsonify({
                "error": "No readable text found in the document."
            }), 400

        if len(extracted_text) > MAX_ARTICLE_LENGTH:
            return jsonify({
                "error": "Extracted text exceeds 20,000 characters."
            }), 400

        return jsonify({
            "text": extracted_text,
            "filename": file.filename,
            "message": "Document uploaded successfully."
        })

    except Exception as error:
        print("Upload error:", error)

        return jsonify({
            "error": "Unable to process the uploaded document."
        }), 500


# Handle files exceeding 10 MB
@app.errorhandler(413)
def file_too_large(error):

    return jsonify({
        "error": "File size exceeds the 10 MB limit."
    }), 413


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
